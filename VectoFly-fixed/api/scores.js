// VectoFly leaderboard for Vercel (serverless function + Firebase Realtime Database).
//   GET  /api/scores?limit=20          -> { scores: [ { n, s, k } ... ], visitors, games }
//   GET  /api/scores?debug=1           -> health check (never prints secrets)
//   POST /api/scores {action:'visit'}  -> counts this device once
//   POST /api/scores {action:'start'}  -> { t } signed single-use run ticket (anti-cheat), counts one game played
//   POST /api/scores {score,...,t}     -> { ok, rank, best, k } submit a finished run
// The browser never talks to Firebase directly: only this function does, with admin credentials, so the
// database rules can stay fully locked (no public read or write) and nobody can write fake scores.
//
// Vercel environment variables:
//   FIREBASE_DB_URL           e.g. https://my-project-default-rtdb.firebaseio.com
//   FIREBASE_SERVICE_ACCOUNT  the whole service-account JSON file (Firebase > Project settings > Service accounts)
//   (or, simpler but older) FIREBASE_SECRET = a legacy "database secret" instead of FIREBASE_SERVICE_ACCOUNT
//   SCORE_SECRET              optional: extra secret used to sign run tickets
'use strict';
const crypto = require('crypto');

// ---------- configuration ----------
function readServiceAccount() {
  let raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  if (raw[0] !== '{') { try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) {} }   // base64 is accepted too
  try {
    const j = JSON.parse(raw);
    if (j.private_key) j.private_key = String(j.private_key).replace(/\\n/g, '\n');
    return j;
  } catch (e) { return { _bad: true }; }
}
const SA = readServiceAccount();
const FB_SECRET = String(process.env.FIREBASE_SECRET || '').trim();
let DB = String(process.env.FIREBASE_DB_URL || process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
if (!DB && SA && SA.project_id) DB = 'https://' + SA.project_id + '-default-rtdb.firebaseio.com';   // US default; other regions need FIREBASE_DB_URL
const TOKEN_URL = process.env.VF_TOKEN_URL || 'https://oauth2.googleapis.com/token';

function configProblem() {
  if (!DB) return 'FIREBASE_DB_URL is missing. Add your Realtime Database URL in Vercel > Settings > Environment Variables, then redeploy.';
  if (!/^https?:\/\//.test(DB)) return 'FIREBASE_DB_URL must start with https://';
  if (!FB_SECRET && !SA) return 'FIREBASE_SERVICE_ACCOUNT is missing. Paste the whole service-account JSON in Vercel > Settings > Environment Variables, then redeploy.';
  if (!FB_SECRET && SA && (SA._bad || !SA.client_email || !SA.private_key)) return 'FIREBASE_SERVICE_ACCOUNT is not valid JSON (it must contain client_email and private_key). Paste the complete downloaded file.';
  return '';
}

const SECRET = process.env.SCORE_SECRET || crypto.createHash('sha256').update('vf|' + (FB_SECRET || (SA && SA.private_key_id) || '') + '|' + (SA && SA.client_email || '')).digest('hex');
const MAX_ENTRIES = 5000, ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const MULT = { easy: 1, medium: 1.25, hard: 1.5, hell: 2 };
const MAX_DIST_PER_SEC = 135;            // the game tops out around 120 units/s on Hell
const pub = id => crypto.createHash('sha256').update(id).digest('hex').slice(0, 10);

// ---------- Firebase Realtime Database over REST (admin access) ----------
let tok = null, tokExp = 0;
async function accessToken() {
  if (tok && Date.now() < tokExp - 60000) return tok;
  const now = Math.floor(Date.now() / 1000), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(SA.private_key, 'base64url');
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + claim + '.' + sig });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google sign-in failed: ' + (j.error_description || j.error || r.status));
  tok = j.access_token; tokExp = Date.now() + (j.expires_in || 3600) * 1000;
  return tok;
}
async function fb(method, path, o) {
  o = o || {};
  const q = new URLSearchParams(o.query || {});
  if (FB_SECRET) q.set('auth', FB_SECRET); else q.set('access_token', await accessToken());
  const r = await fetch(DB + path + '.json?' + q.toString(), {
    method, headers: Object.assign({ 'Content-Type': 'application/json' }, o.headers || {}),
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
  if (o.okStatus && o.okStatus.indexOf(r.status) > -1) return { status: r.status, data: null };
  const text = await r.text();
  if (!r.ok) throw new Error('Firebase ' + r.status + ': ' + text.slice(0, 160));
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
// write only if nothing exists there yet (atomic): used for single-use tickets and the one-time visitor count
async function createIfAbsent(path, value) {
  const r = await fb('PUT', path, { body: value, headers: { 'if-match': 'null_etag' }, okStatus: [412] });
  return r.status !== 412;
}
const inc = n => ({ '.sv': { increment: n } });

// ---------- helpers ----------
// Pilot names are random: only "Adjective Noun NN" from these lists is accepted (same lists as js/vectofly.js).
// Anything else (old typed names, tampered requests) is replaced by a name derived from the player id, so no free text is ever stored or shown.
const NAME_ADJ = ['Swift','Brave','Bold','Calm','Clever','Cosmic','Daring','Fierce','Gentle','Golden','Happy','Jolly','Lucky','Mighty','Nimble','Noble','Proud','Rapid','Silent','Sunny','Stormy','Turbo','Wild','Witty'];
const NAME_NOUN = ['Falcon','Eagle','Hawk','Raven','Condor','Osprey','Comet','Rocket','Jet','Pilot','Ace','Cloud','Storm','Blaze','Bolt','Dragon','Viper','Wolf','Tiger','Otter','Panda','Fox','Lynx','Rider'];
function derivedName(id) { const h = crypto.createHash('sha256').update('name|' + id).digest(); return NAME_ADJ[h[0] % NAME_ADJ.length] + ' ' + NAME_NOUN[h[1] % NAME_NOUN.length] + ' ' + (10 + h[2] % 90); }
function validName(n) { const p = String(n == null ? '' : n).split(' '); return p.length === 3 && NAME_ADJ.indexOf(p[0]) > -1 && NAME_NOUN.indexOf(p[1]) > -1 && /^\d\d$/.test(p[2]); }
function cleanName(n, id) { return validName(n) ? String(n) : derivedName(id); }
function send(res, code, obj, cache) {
  res.status(code);
  res.setHeader('Cache-Control', cache ? 'public, max-age=0, s-maxage=' + cache + ', stale-while-revalidate=' + cache*2 : 'no-store, max-age=0');
  if (!cache){ res.setHeader('CDN-Cache-Control', 'no-store'); res.setHeader('Vercel-CDN-Cache-Control', 'no-store'); }
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (code === 204) return res.end();
  res.json(obj);
}
function rej(res, code, why, b) {
  console.warn('VectoFly rejected score:', why, JSON.stringify({ d: b && b.diff, s: b && b.score, dist: b && b.dist, pills: b && b.pills, playMs: b && b.playMs }));
  return send(res, code, { error: why });
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0] : (req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '?')).trim();
}
const hits = new Map();   // best-effort per-instance rate limit (the signed single-use tickets are the real protection)
function limited(ip, bucket, max) {
  const now = Date.now(), k = bucket + '|' + ip, h = (hits.get(k) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(k, h);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(key);
  return h.length > max;
}
const sign = (id, ts, nonce) => crypto.createHmac('sha256', SECRET).update([id, ts, nonce].join('.')).digest('hex').slice(0, 32);
function safeEq(a, b) { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); }

async function topScores(limit) {
  const r = await fb('GET', '/scores', { query: { orderBy: '"s"', limitToLast: String(limit) } });
  const o = r.data || {};
  return Object.keys(o).map(id => ({ id, n: o[id].n, s: o[id].s, t: o[id].t || 0 })).filter(e => typeof e.s === 'number')
    .sort((a, b) => b.s - a.s || a.t - b.t);
}
async function stats() { const m = (await fb('GET', '/meta')).data || {}; return { visitors: +m.visitors || 0, games: +m.games || 0 }; }
async function prune() {          // forget old single-use tickets so the database stays tiny
  const r = await fb('GET', '/used', { query: { orderBy: '"$value"', endAt: String(Date.now() - 4 * 3600e3), limitToFirst: '200' } });
  const keys = Object.keys(r.data || {}); if (!keys.length) return;
  const patch = {}; keys.forEach(k => { patch[k] = null; });
  await fb('PATCH', '/used', { body: patch });
}
async function trim() {           // keep at most MAX_ENTRIES players: drop the lowest scores
  const r = await fb('GET', '/scores', { query: { shallow: 'true' } });
  const n = Object.keys(r.data || {}).length; if (n <= MAX_ENTRIES) return;
  const low = await fb('GET', '/scores', { query: { orderBy: '"s"', limitToFirst: String(Math.min(500, n - MAX_ENTRIES)) } });
  const patch = {}; Object.keys(low.data || {}).forEach(k => { patch[k] = null; });
  if (Object.keys(patch).length) await fb('PATCH', '/scores', { body: patch });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return send(res, 204);

    const problem = configProblem();
    if (problem) {
      console.error('VectoFly: ' + problem);
      if (req.method === 'GET' && req.query && req.query.debug) return send(res, 200, { ok: false, problem });
      return send(res, 503, { error: 'server', hint: problem });
    }

    if (req.method === 'GET') {
      if (req.query && req.query.debug) {
        let read = 'ok', write = 'ok', count = -1;
        try { count = Object.keys((await fb('GET', '/scores', { query: { shallow: 'true' } })).data || {}).length; } catch (e) { read = 'failed: ' + String(e && e.message || e).slice(0, 200); }
        try { await fb('PUT', '/debug', { body: Date.now() }); } catch (e) { write = 'failed: ' + String(e && e.message || e).slice(0, 200); }
        return send(res, 200, { ok: read === 'ok' && write === 'ok', mode: 'firebase', auth: FB_SECRET ? 'database secret' : 'service account', read, write, playersStored: count, database: DB.replace(/^https?:\/\//, '') });
      }
      const limit = Math.max(1, Math.min(1000, +(req.query && req.query.limit) || 50));
      const [list, st] = await Promise.all([topScores(limit), stats()]);
      return send(res, 200, { scores: list.slice(0, limit).map(e => ({ n: validName(e.n) ? e.n : derivedName(e.id), s: e.s, k: pub(e.id) })), visitors: st.visitors, games: st.games, at: Date.now() }, limit > 100 ? 5 : 0);
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method' });

    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== 'object') return send(res, 400, { error: 'json' });
    const id = String(b.id || '');
    if (!/^[a-z0-9]{6,32}$/.test(id)) return send(res, 400, { error: 'id' });
    const ip = clientIp(req);

    // ---- visitor counter: each device counts once, reloads never double count ----
    if (b.action === 'visit') {
      if (limited(ip, 'visit', 30)) return send(res, 429, { error: 'slow down' });
      if (await createIfAbsent('/visitors/' + id, 1)) await fb('PATCH', '/meta', { body: { visitors: inc(1) } });
      return send(res, 200, Object.assign({ ok: true, k: pub(id) }, await stats()));
    }

    // ---- step 1: a run ticket, issued when the flight starts (this also counts one game played) ----
    if (b.action === 'start') {
      if (limited(ip, 'start', 40)) return send(res, 429, { error: 'slow down' });
      const ts = Date.now(), nonce = crypto.randomBytes(8).toString('hex');
      await fb('PATCH', '/meta', { body: { games: inc(1) } });
      const st = await stats();
      return send(res, 200, { t: [ts, nonce, sign(id, ts, nonce)].join('.'), games: st.games, k: pub(id) });
    }

    // ---- step 2: submit the finished run ----
    if (limited(ip, 'submit', 20)) return send(res, 429, { error: 'slow down' });
    const score = Math.floor(+b.score), dist = Math.floor(+b.dist), level = Math.floor(+b.level), pills = Math.floor(+b.pills), playMs = Math.floor(+b.playMs);
    const mult = MULT[String(b.diff)];
    if (!(score > 0) || !(dist >= 0) || !(level >= 1) || !(pills >= 0) || !(playMs > 0) || !mult) return send(res, 400, { error: 'numbers' });

    // the ticket must be ours, bound to this player, fresh, and unused
    const parts = String(b.t || '').split('.');
    if (parts.length !== 3 || !/^\d{10,14}$/.test(parts[0]) || !/^[a-f0-9]{16}$/.test(parts[1])) return rej(res, 403, 'ticket', b);
    const ts = +parts[0], nonce = parts[1];
    if (!safeEq(parts[2], sign(id, ts, nonce))) return rej(res, 403, 'ticket', b);
    const elapsed = Date.now() - ts;
    if (elapsed < 0 || elapsed > 3 * 3600e3) return rej(res, 403, 'expired', b);
    if (!(await createIfAbsent('/used/' + nonce, Date.now()))) return rej(res, 403, 'replay', b);

    // physics-based plausibility: what the game can actually produce in that much real time
    const sec = elapsed / 1000;
    if (dist > sec * MAX_DIST_PER_SEC + 60) return rej(res, 422, 'too fast', b);
    if (playMs > elapsed + 3000) return rej(res, 422, 'clock', b);
    if (dist > (playMs / 1000) * MAX_DIST_PER_SEC + 60) return rej(res, 422, 'too fast', b);
    if (Math.abs(level - (1 + Math.floor(dist / 1000))) > 1) return rej(res, 422, 'level', b);
    if (pills > dist / 85 * 10 + 10) return rej(res, 422, 'pills', b);
    if (Math.abs(score - Math.floor((dist + pills * 5) * mult)) > 3) return rej(res, 422, 'score', b);
    if (dist > 5e6 || score > 1e7) return rej(res, 422, 'implausible', b);

    const name = cleanName(b.name, id), prevR = await fb('GET', '/scores/' + id + '/s'), prev = typeof prevR.data === 'number' ? prevR.data : null;
    let best = prev;
    if (prev === null || score > prev) {
      best = score;
      await fb('PUT', '/scores/' + id, { body: { n: name, s: score, d: dist, l: level, p: String(b.plane || '').slice(0, 16), df: String(b.diff), t: Date.now() } });
      if (Math.random() < .05) { try { await trim(); } catch (e) {} }
    } else {
      await fb('PATCH', '/scores/' + id, { body: { n: name } });       // same or lower score: only keep the latest name
    }
    if (Math.random() < .03) { try { await prune(); } catch (e) {} }
    let rank = null;
    try { const top = await topScores(100); const i = top.findIndex(e => e.id === id); if (i > -1) rank = i + 1; } catch (e) {}
    return send(res, 200, { ok: true, rank, best, k: pub(id) });
  } catch (e) {
    console.error('VectoFly API error:', e && e.message ? e.message : e);
    return send(res, 500, { error: 'server', hint: 'Firebase connection problem. Open /api/scores?debug=1 to see what is wrong.', detail: String(e && e.message || e).slice(0, 160) });
  }
};
