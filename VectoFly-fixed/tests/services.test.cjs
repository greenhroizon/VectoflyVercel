const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  vm = require("node:vm"),
  { spawn } = require("node:child_process"),
  { once } = require("node:events");
const root = path.resolve(__dirname, "..");
test("current zero-game save wins over legacy save; free grants preserve wallet and paid unlocks", () => {
  const store = {
    vectofly_save_v1: JSON.stringify({
      games: 0,
      wallet: 777,
      plane: "classic",
      planes: ["classic", "paid-plane"],
      maps: ["coast", "paid-map"],
    }),
    flyaero_save_v1: JSON.stringify({ games: 0, wallet: 1 }),
  };
  const c = {
    window: { addEventListener() {}, VECTOFLY_CONFIG: {} },
    navigator: {},
    console,
    localStorage: {
      getItem(k) {
        return store[k] || null;
      },
      setItem(k, v) {
        store[k] = v;
      },
    },
  };
  vm.createContext(c);
  const src = fs
    .readFileSync(root + "/js/vectofly.js", "utf8")
    .replace(
      "return F;",
      "F.testLoad=function(){load();grantFree();save();return S;}; return F;",
    );
  vm.runInContext(src, c);
  const saved = c.VF.testLoad();
  assert.equal(saved.wallet, 777);
  assert.ok(saved.planes.includes("paid-plane"));
  assert.ok(saved.maps.includes("paid-map"));
  assert.ok(saved.planes.length >= 6);
  assert.ok(saved.maps.length >= 5);
});
test("Node leaderboard pagination has stable ranks, ties, totals and no duplicate entries", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vf-test-")),
    file = path.join(temp, "scores.json"),
    data = {};
  for (let i = 0; i < 125; i++)
    data["pilot-" + i] = { n: "Pilot " + i, s: 1000 - Math.floor(i / 2), t: i };
  fs.writeFileSync(file, JSON.stringify(data));
  const proc = spawn(process.execPath, [root + "/server/server.js"], {
    env: { ...process.env, PORT: "3107", DATA_FILE: file },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await once(proc.stdout, "data");
    let keys = new Set();
    for (const offset of [0, 50, 100]) {
      const res = await fetch(
        "http://localhost:3107/api/scores?limit=50&offset=" + offset,
      );
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.equal(j.total, 125);
      assert.equal(j.hasMore, offset < 100);
      j.scores.forEach((e, i) => {
        assert.equal(e.r, offset + i + 1);
        assert.ok(!keys.has(e.k));
        keys.add(e.k);
      });
    }
    assert.equal(keys.size, 125);
    const start = await fetch("http://localhost:3107/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", id: "testpilot1234" }),
    });
    assert.equal(start.status, 200);
    assert.ok((await start.json()).t);
    for (const page of ["", "leaderboard.html", "privacy.html", "contact.html"])
      assert.equal((await fetch("http://localhost:3107/" + page)).status, 200);
  } finally {
    proc.kill("SIGTERM");
    await once(proc, "exit");
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test("Vercel/Firebase leaderboard matches paginated global ranking contract", async () => {
  const original = global.fetch;
  process.env.FIREBASE_DB_URL = "https://test.invalid";
  process.env.FIREBASE_SECRET = "test-only";
  const data = {};
  for (let i = 0; i < 125; i++)
    data["pilot-" + i] = { n: "Pilot " + i, s: 1000 - i, t: i };
  global.fetch = async (url) => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify(
        String(url).includes("/scores.json")
          ? data
          : { visitors: 10, games: 20 },
      ),
  });
  try {
    const handler = require(root + "/api/scores.js");
    let result, code;
    const res = {
      status(c) {
        code = c;
      },
      setHeader() {},
      json(j) {
        result = j;
      },
      end() {},
    };
    await handler(
      { method: "GET", query: { limit: "50", offset: "100" }, headers: {} },
      res,
    );
    assert.equal(code, 200);
    assert.equal(result.total, 125);
    assert.equal(result.scores.length, 25);
    assert.equal(result.scores[0].r, 101);
    assert.equal(result.hasMore, false);
    assert.equal(result.scores[0].n, "Pilot 100");
  } finally {
    global.fetch = original;
    delete process.env.FIREBASE_DB_URL;
    delete process.env.FIREBASE_SECRET;
  }
});
