// VectoFly ads: Adsterra BANNERS + Monetag PUSH NOTIFICATION. No pop-unders, no click redirects, no overlays.
//
//  GAME PAGE   big screen: 160px ad rails left and right of the game (160x600, or 160x300 on shorter screens)
//              other screens: a small strip under the game (468x60, or 320x50 on phones)
//              they never cover the game: the game area is made smaller to make room, and they stay while flying
//              menu / game-over: a 300x250 box inside the menu (appears ~1.2 s after the score; hidden when a run starts)
//              everything renews only on the game-over screen of every 2nd finished run (never on a timer)
//  INFO PAGES  top 728x90 (mobile 320x50), middle 300x250, bottom 468x60 (mobile 300x250)
//              wide screens (1200px+): 160x600 and 160x300 side rails beside the text
//  PUSH        game: asked once, a moment after the first finished run. Info pages: after 12 s. Re-asked at most every 12 h
//
//  - banners load only when their box is about to scroll into view (better viewability, fewer wasted requests)
//  - an empty (no-fill) box collapses by itself, so there are no blank holes
//  - "Opt out" in the cookie notice switches all ads off in that browser
//  - no rewards for clicking ads (incentivised clicks are forbidden)
(function(){
  'use strict';
  var ENABLED = true;

  var BASE = 'https://bauval.org/22/';           // Adsterra banner host + path, from your codes
  var B = {                                       // Adsterra banner keys
    b300x250: '16382df258b7612079bcd3eeba31d8e7',
    b468x60:  '83537ec1c1d8e71f31f56e196870dace',
    b160x600: 'fdfddc5e1a1354593582c1c006b1fc1b',
    b320x50:  '7da4c475de5c765c21960db8d5974e19',
    b728x90:  '1a8bb043a682ddf78c9ab09554d058e5',
    b160x300: 'd62454dfdf00cb6143a56ae4156bb35d'
  };
  var PUSH = { src: 'https://5gvci.com/act/files/tag.min.js?z=12233420', gapMs: 12 * 3600e3 };   // Monetag push zone
  var T = { overDelayMs: 1200, pushAfterOverMs: 2600, infoPushMs: 12000 };
  var PUSH_AFTER_RUNS = 1, MENU_EVERY_N_RUNS = 2, MENU_MIN_GAP_MS = 90000;
  var RAILS_MIN_WIDTH = 1200;

  if (!ENABLED) return;
  function lget(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  if (lget('vf_ads_off') === '1') return;

  var isGame = !!document.getElementById('panel');
  var wide = function(){ return (window.innerWidth || 800) >= 760; };

  // ---------- banners: Adsterra reads one global (atOptions), so they load one after another ----------
  var queue = [], busy = false;
  function enqueue(fn){ queue.push(fn); pump(); }
  function pump(){
    if (busy || !queue.length) return;
    busy = true;
    var fn = queue.shift(), done = false;
    function next(){ if (done) return; done = true; busy = false; pump(); }
    try { fn(next); } catch (e) { next(); }
    setTimeout(next, 4000);
  }
  function spec(key, w, h){ return { key: key, w: w, h: h }; }

  function render(box, sp, onEmpty){
    if (!box || !sp) return false;
    box.innerHTML = '';
    var l = document.createElement('span'); l.className = 'ad-label'; l.textContent = 'Advertisement';
    var body = document.createElement('div'); body.className = 'ad-body'; body.style.minHeight = sp.h + 'px';
    box.appendChild(l); box.appendChild(body); box.classList.add('on');
    enqueue(function(next){
      window.atOptions = { key: sp.key, format: 'iframe', height: sp.h, width: sp.w, params: {} };
      var s = document.createElement('script'); s.src = BASE + sp.key; s.async = false;
      s.onload = s.onerror = next;
      body.appendChild(s);
    });
    setTimeout(function(){ if (!body.querySelector('iframe, img, a, ins')){ box.classList.remove('on'); box.innerHTML = ''; if (onEmpty) onEmpty(); } }, 9000);
    return true;
  }
  function whenVisible(box, fn){
    if (!('IntersectionObserver' in window)){ fn(); return; }
    var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting){ io.disconnect(); fn(); } }, { rootMargin: '250px 0px' });
    io.observe(box);
  }

  // ---------- push notification (asked rarely, never while flying) ----------
  var pushed = false;
  function askPush(){
    if (pushed) return;
    if (window.Notification && Notification.permission === 'denied') return;
    var last = +lget('vf_ad_push') || 0;
    if (Date.now() - last < PUSH.gapMs) return;
    pushed = true; lset('vf_ad_push', String(Date.now()));
    var s = document.createElement('script'); s.async = true; s.src = PUSH.src; s.setAttribute('data-cfasync', 'false');
    (document.body || document.documentElement).appendChild(s);
  }

  // ---------- information pages ----------
  function placement(name){
    var w = wide();
    switch (name){
      case 'top':    return w ? spec(B.b728x90, 728, 90) : spec(B.b320x50, 320, 50);
      case 'mid':    return spec(B.b300x250, 300, 250);
      case 'bottom': return w ? spec(B.b468x60, 468, 60) : spec(B.b300x250, 300, 250);
    }
    return null;
  }
  function rails(){
    if ((window.innerWidth || 0) < RAILS_MIN_WIDTH) return;
    var st = document.createElement('style');
    st.textContent = '.vf-rail{position:fixed;top:96px;z-index:5;text-align:center}.vf-rail:not(.on){display:none}' +
      '.vf-rail.l{left:calc(50% - 410px - 180px)}.vf-rail.r{right:calc(50% - 410px - 180px)}' +
      '.vf-rail .ad-label{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:4px}' +
      '.vf-rail .ad-body{display:flex;justify-content:center}';
    document.head.appendChild(st);
    [['l', spec(B.b160x300, 160, 300)], ['r', spec(B.b160x600, 160, 600)]].forEach(function(p){
      var d = document.createElement('div'); d.className = 'vf-rail ' + p[0]; d.setAttribute('aria-label', 'Advertisement');
      d.setAttribute('data-vf-keep', '1'); document.body.appendChild(d);
      render(d, p[1]);
    });
  }
  function startInfo(){
    var boxes = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < boxes.length; i++){
      (function(box){
        var sp = placement(box.getAttribute('data-ad-slot'));
        if (sp) whenVisible(box, function(){ render(box, sp); });
      })(boxes[i]);
    }
    setTimeout(rails, 600);
    setTimeout(askPush, T.infoPushMs);
  }

  // ---------- the game page ----------
  // The game area is shrunk (CSS variables on #gameHolder) to leave room, so ads never sit on top of the game:
  //   big screen  (1100px+ wide, 420px+ tall): a 160px rail on each side, 160x600 if the screen is 700px+ tall, else 160x300
  //   other screens: a small strip under the game, 468x60 (560px+ wide) or 320x50
  // They stay on screen while flying; they renew only on the game-over screen of every 2nd run (never on a timer).
  function gameMode(){
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (w >= 1100 && h >= 420) return h >= 700 ? { m: 'rails', k: 'r600', w: 160, h: 600, key: B.b160x600 } : { m: 'rails', k: 'r300', w: 160, h: 300, key: B.b160x300 };
    if (w >= 340 && h >= 340) return w >= 560 ? { m: 'bar', k: 'b468', w: 468, h: 60, key: B.b468x60 } : { m: 'bar', k: 'b320', w: 320, h: 50, key: B.b320x50 };
    return { m: 'none', k: 'none' };
  }
  var gl = { cur: '', L: null, R: null, bar: null, styled: false, last: 0 };
  function setVars(l, r, b){
    var st = document.documentElement.style;
    st.setProperty('--vf-l', l); st.setProperty('--vf-r', r); st.setProperty('--vf-b', b);
  }
  function glStyle(){
    if (gl.styled) return; gl.styled = true;
    var st = document.createElement('style');
    st.textContent =
      '.vf-gr{position:fixed;top:50%;transform:translateY(-50%);z-index:3;width:160px;text-align:center}.vf-gr.l{left:8px}.vf-gr.r{right:8px}' +
      '.vf-gr .ad-label{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#59332e;opacity:.6;margin-bottom:4px}' +
      '.vf-gr .ad-body{display:flex;justify-content:center;overflow:hidden}' +
      '.vf-gb{position:fixed;left:0;right:0;bottom:0;z-index:3;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px));background:rgba(35,25,15,.92)}' +
      '.vf-gb .ad-label{display:block;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#f4ce93;opacity:.7;margin-bottom:3px;line-height:1}' +
      '.vf-gb .ad-body{display:flex;justify-content:center;overflow:hidden;max-width:100%}';
    document.head.appendChild(st);
  }
  function mk(cls){
    var d = document.createElement('div'); d.className = cls; d.setAttribute('aria-label', 'Advertisement'); d.setAttribute('data-vf-keep', '1');
    document.body.appendChild(d); return d;
  }
  function glClear(){
    ['L', 'R', 'bar'].forEach(function(k){ if (gl[k]){ gl[k].remove(); gl[k] = null; } });
    setVars('0px', '0px', '0px');
  }
  function glApply(force){
    var g = gameMode();
    if (g.k === gl.cur && !force) return;
    var changed = g.k !== gl.cur; gl.cur = g.k; gl.last = Date.now();
    glStyle();
    if (changed) glClear();
    if (g.m === 'rails'){
      var side = g.w + 16 + 'px';
      if (!gl.L) gl.L = mk('vf-gr l'); if (!gl.R) gl.R = mk('vf-gr r');
      setVars(side, side, '0px');
      render(gl.L, spec(g.key, g.w, g.h), function(){ setVars('0px', gl.R && gl.R.classList.contains('on') ? side : '0px', '0px'); });
      render(gl.R, spec(g.key, g.w, g.h), function(){ setVars(gl.L && gl.L.classList.contains('on') ? side : '0px', '0px', '0px'); });
    } else if (g.m === 'bar'){
      if (!gl.bar) gl.bar = mk('vf-gb');
      var hh = g.h + 20;
      gl.bar.style.height = 'calc(' + hh + 'px + env(safe-area-inset-bottom,0px))';
      setVars('0px', '0px', 'calc(' + hh + 'px + env(safe-area-inset-bottom,0px))');
      render(gl.bar, spec(g.key, g.w, g.h), function(){ setVars('0px', '0px', '0px'); });
    }
  }

  function startGame(){
    var box1 = null, box2 = null, finished = 0, overs = 0, flew = true, shown = false, last = 0, pending = false, rz = 0;
    // game ads (rails / strip) appear shortly after the game is up, and follow the window size
    setTimeout(function(){ glApply(false); }, 1800);
    window.addEventListener('resize', function(){ clearTimeout(rz); rz = setTimeout(function(){ if (gl.cur) glApply(false); }, 400); });
    window.VFAds = {
      show: function(mode){
        box1 = box1 || document.getElementById('adMenu'); box2 = box2 || document.getElementById('adMenu2');
        if (box2) box2.hidden = true;                    // the rails / strip replace the second menu box
        var fresh = flew; flew = false;                 // count a finished run once, not on every redraw of the screen
        var renew = false;
        if (mode === 'over' && fresh){
          finished++; overs++;
          if (finished >= PUSH_AFTER_RUNS) setTimeout(askPush, T.pushAfterOverMs);
          if (overs >= MENU_EVERY_N_RUNS && Date.now() - last >= MENU_MIN_GAP_MS){ renew = true; }
        }
        if (renew) setTimeout(function(){ if (gl.cur && gl.cur !== 'none') glApply(true); }, T.overDelayMs + 300);
        if (!box1) return;
        box1.hidden = false;
        var due = !shown || renew;
        if (!due || pending) return;
        pending = true;
        var go = function(){
          whenVisible(box1, function(){
            pending = false; if (box1.hidden) return;
            shown = true; last = Date.now(); overs = 0;
            render(box1, spec(B.b300x250, 300, 250));
          });
        };
        if (mode === 'over') setTimeout(go, T.overDelayMs); else go();
      },
      hide: function(){
        flew = true;
        if (box1) box1.hidden = true;                   // the big menu box goes away; the rails / strip stay, outside the game area
      }
    };
  }

  if (isGame) startGame(); else startInfo();
})();
