const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
function core() {
  let els = {};
  const c = {
    console,
    Math,
    Date,
    setTimeout,
    requestAnimationFrame() {},
    window: { innerWidth: 390, innerHeight: 844, addEventListener() {} },
    document: {
      getElementById(id) {
        return (
          els[id] || (els[id] = { innerHTML: "", style: {}, setAttribute() {} })
        );
      },
    },
    navigator: {},
    isMobile: true,
    Colors: { red:0xf25346, white:0xd8d0d1, brown:0x59332e, brownDark:0x23190f, pink:0xf5986e, yellow:0xf4ce93, blue:0x68c3c0 },
    VF: {
      touching: true,
      padHeld() {
        return false;
      },
    },
  };
  c.window.VF = c.VF;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(root + "/js/three.min.js", "utf8"), c);
  vm.runInContext(fs.readFileSync(root + "/js/game.js", "utf8"), c);
  c.fieldLevel = c.document.getElementById("level");
  c.resetGame();
  c.renderer = { setSize() {} };
  c.camera = new c.THREE.PerspectiveCamera(50, 1, 0.1, 10000);
  c.airplane = { mesh: new c.THREE.Object3D(), pilot: { updateHairs() {} } };
  c.airplane.mesh.position.set(-65, 100, 0);
  return c;
}
test("responsive camera retains aircraft and flight band at five viewport sizes", () => {
  const c = core();
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1366, 768],
  ]) {
    c.window.innerWidth = w;
    c.window.innerHeight = h;
    c.handleWindowResize();
    c.camera.updateMatrixWorld();
    for (const y of [20, 100, 180]) {
      const p = new c.THREE.Vector3(-75, y, 0).project(c.camera);
      assert.ok(Math.abs(p.x) < 0.8);
      assert.ok(Math.abs(p.y) < 0.8);
    }
    assert.ok(c.SPAWN_X > 150);
  }
});
test("10,000 generated waves have a protected corridor and bounded gate transitions", () => {
  const c = core();
  c.ennemiesHolder = new c.EnnemiesHolder();
  let total = 0;
  for (let i = 0; i < 10000; i++) {
    let entries = [];
    c.ennemiesHolder.add = (x, y, seek) => entries.push({ x, y, seek });
    c.game.level = 1 + Math.floor(i / 100);
    let last = c.game.safeLane;
    c.ennemiesHolder.spawnEnnemies();
    assert.ok(Math.abs(c.game.safeLane - last) <= 1);
    for (const e of entries) {
      assert.ok(Math.abs(e.y - c.laneY(c.game.safeLane)) >= 30);
      assert.equal(e.seek, false);
    }
    assert.ok(entries.length > 0);
    total += entries.length;
  }
  assert.ok(total > 20000);
});
test("relative touch re-anchors, clamps, cancels and ignores menu controls", () => {
  const c = core();
  c.WIDTH = 390;
  c.HEIGHT = 844;
  let target = {
    closest() {
      return false;
    },
  };
  c.handleTouchStart({
    target,
    changedTouches: [{ identifier: 1, clientX: 120, clientY: 400, target }],
  });
  c.handleTouchMove({
    touches: [{ identifier: 1, clientX: 120, clientY: 200 }],
    preventDefault() {},
  });
  assert.equal(c.mousePos.y, 1);
  c.handleTouchEnd({ changedTouches: [{ identifier: 1 }] });
  assert.equal(c.steer, null);
  target = {
    closest() {
      return true;
    },
  };
  c.handleTouchStart({ target, changedTouches: [{ identifier: 2, target }] });
  assert.equal(c.steer, null);
});
test("smoothing and collision displacement remain within flight band", () => {
  const c = core();
  c.deltaTime = 50;
  c.aspectRatio = 0.46;
  c.mousePos = { x: 1, y: 1 };
  c.game.planeCollisionDisplacementY = 300;
  for (let i = 0; i < 100; i++) {
    c.updatePlane();
    assert.ok(c.airplane.mesh.position.y <= 180);
    assert.ok(c.airplane.mesh.position.y >= 20);
    assert.ok(Number.isFinite(c.airplane.mesh.position.x));
  }
});
test("important pages have canonical, contact, one analytics loader and valid local links", () => {
  for (const name of fs.readdirSync(root).filter((n) => n.endsWith(".html"))) {
    let s = fs.readFileSync(root + "/" + name, "utf8");
    assert.equal((s.match(/src="\/?js\/analytics.js"/g) || []).length, 1, name);
    assert.ok(!/YOUR-DOMAIN|itsvasudev404/.test(s));
    for (const m of s.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
      const link = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(link)) continue;
      assert.ok(
        fs.existsSync(path.resolve(root, link.replace(/^\//, ""))),
        name + " → " + link,
      );
    }
  }
});

test('swept collision catches a spike crossing the player in one frame without NaN knockback',()=>{
 const c=core();c.ennemiesHolder=new c.EnnemiesHolder();c.ennemiesHolder.add(-40,100,false);c.airplane.mesh.position.set(-65,100,0);c.airplane.prevX=-65;c.airplane.prevY=100;c.dxFrame=50;c.deltaTime=50;c.game.ennemiesSpeed=1;c.ambientLight={intensity:0};c.particlesHolder={spawnParticles(){}};c.VF.onHit=()=>{};c.hitFlash=()=>{};c.ennemiesHolder.rotateEnnemies();assert.equal(c.game.damage,20);assert.ok(Number.isFinite(c.game.planeCollisionSpeedX));assert.ok(Number.isFinite(c.game.planeCollisionSpeedY));assert.equal(c.ennemiesHolder.ennemiesInUse.length,0);
});

test('first five free aircraft build with valid 3D geometry',()=>{
 const c=core();vm.runInContext(fs.readFileSync(root+'/js/planes.js','utf8'),c);
 for(const kind of ['paper','warbird','triplane','gyro','twinboom']){const p=c.PB.build(kind,null,'#f25346');assert.ok(p.mesh.children.length>0);assert.ok(p.pilot);assert.ok(p.propeller);p.mesh.traverse(o=>{if(o.geometry && o.geometry.vertices)for(const v of o.geometry.vertices)assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z));});}
});

test('supporting pages share themed navigation, unique section anchors and accessible artwork',()=>{
 for(const slug of ['about','contact','how-to-play','leaderboard','privacy','terms','cookie-policy','disclaimer','dmca']){
  const s=fs.readFileSync(root+'/'+slug+'.html','utf8');
  assert.ok(s.includes('class="site-page"'),slug);
  assert.ok(s.includes('class="site-header"'),slug);
  assert.ok(s.includes('class="page-hero"'),slug);
  assert.ok(s.includes('class="site-footer"'),slug);
  assert.ok(s.includes('id="page-content"'),slug);
  assert.ok(/<svg[^>]+aria-hidden="true"/.test(s),slug);
  const ids=[...s.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,slug+' duplicate ID');
  for(const m of s.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),slug+' missing anchor '+m[1]);
 }
});
