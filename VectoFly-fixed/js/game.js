// VectoFly core: scene, flat endless Chrome-dino-style world, obstacles, blue pills, fuel, DAMAGE, main loop.
// Based on "The Aviator" by Karim Maaloul (Codrops). isMobile + Colors live in config.js.

// GAME VARIABLES
var game;
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();
var ennemiesPool = [];
var particlesPool = [];

// world scrolling: how many world units the ground / obstacles move per (speed * millisecond)
var K_SCROLL = 420;
var SPAWN_X = 470, DESPAWN_X = -340;
// XS squeezes the world horizontally on narrow (portrait) screens. A phone shows far less width than a monitor, so the world scrolls
// slower and spawns closer: you get the same reaction time, and everything is bigger on screen. Scoring is not affected.
var XS = 1;
function updateXS(){
  var a = (WIDTH||1) / (HEIGHT||1);
  XS = Math.max(.5, Math.min(1, .5 + (a - .46)*.6));
  SPAWN_X = Math.round(470*XS); DESPAWN_X = Math.round(-340*XS);
}
var dxFrame = 0;                                  // world units scrolled this frame

function resetGame(){
  game = {speed:0,
          initSpeed:.00044,
          baseSpeed:.00044,
          targetBaseSpeed:.00044,
          incrementSpeedByTime:.0000025,
          incrementSpeedByLevel:.000005,
          distanceForSpeedUpdate:100,
          speedLastUpdate:0,

          distance:0,
          ratioSpeedDistance:50,
          damage:0,                              // 0 = pristine, 100 = the plane is destroyed

          level:1,
          levelLastUpdate:0,
          distanceForLevelUpdate:1000,

          planeDefaultHeight:100,
          planeAmpHeight:80,
          planeAmpWidth:75,
          planeMoveSensivity:0.005,
          planeRotXSensivity:0.0008,
          planeRotZSensivity:0.0004,
          planeFallSpeed:.001,
          planeMinSpeed:1.2,
          planeMaxSpeed:1.6,
          planeSpeed:0,
          planeCollisionDisplacementX:0,
          planeCollisionSpeedX:0,

          planeCollisionDisplacementY:0,
          planeCollisionSpeedY:0,

          cameraFarPos:500,
          cameraNearPos:150,
          cameraSensivity:0.002,

          coinDistanceTolerance:15,
          coinValue:2,                           // damage repaired by one blue pill
          coinsSpeed:1,
          coinLastSpawn:0,
          distanceForCoinsSpawn:85,

          ennemyDistanceTolerance:11,
          ennemyValue:20,                        // damage taken from one red spike
          ennemiesSpeed:1,
          ennemyLastSpawn:0,
          distanceForEnnemiesSpawn:48, spawnStart:48, spawnMin:30, spawnStep:2.5, waveBase:2,
          safeLane:3, waveN:0, idleMs:0, idleY:100, forceSeek:false, dda:1, hitSinceWave:false, gatePlan:null, sinceSeek:0, lastKind:'', reason:"",
          fuel:100, fuelBase:.075, fuelPerLevel:.004, fuelEff:1, fuelValue:40, fuelLastSpawn:0, distanceForFuelSpawn:450,
          maxBaseSpeed:.0011,
          speedPerMeter:.00000012,
          crashT:0,

          status : "playing"
         };
  fieldLevel.innerHTML = Math.floor(game.level);
}

//THREEJS RELATED VARIABLES

var scene,
    camera, fieldOfView, aspectRatio, nearPlane, farPlane,
    renderer,
    container,
    controls;

//SCREEN & MOUSE VARIABLES

var HEIGHT, WIDTH,
    mousePos = { x: 0, y: 0 };

//INIT THREE JS, SCREEN AND MOUSE EVENTS

// The size of what is really on screen: the full-screen #world box (fixed to the visible viewport), not window.innerHeight,
// which some mobile browsers report too small after their address bar or navigation bar hides (that left a blank strip at the bottom).
function viewSize() {
  var el = document.getElementById('world'), r = el ? el.getBoundingClientRect() : null, vv = window.visualViewport;
  var w = Math.round((r && r.width) || (vv && vv.width) || window.innerWidth);
  var h = Math.round((r && r.height) || (vv && vv.height) || window.innerHeight);
  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

function createScene() {

  var vs = viewSize();
  HEIGHT = vs.h;
  WIDTH = vs.w;

  scene = new THREE.Scene();
  aspectRatio = WIDTH / HEIGHT; updateXS();
  fieldOfView = 50;
  nearPlane = .1;
  farPlane = 10000;
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    nearPlane,
    farPlane
    );
  scene.fog = new THREE.Fog(0xf7d9aa, 220, 1150);
  camera.position.x = 0;
  camera.position.z = 200;
  camera.position.y = game.planeDefaultHeight;

  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile }); }
  catch(e){ document.body.innerHTML='<p style="padding:24px;font-family:sans-serif">Sorry, WebGL is not supported on this device or browser.</p>'; throw e; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isMobile?1.5:2));
  renderer.setSize(WIDTH, HEIGHT);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // soft shadow edges

  container = document.getElementById('world');
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', handleWindowResize, false);
  window.addEventListener('orientationchange', function(){ setTimeout(handleWindowResize,300); }, false);
  window.addEventListener('pageshow', handleWindowResize, false);
  document.addEventListener('fullscreenchange', function(){ setTimeout(handleWindowResize,200); }, false);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', handleWindowResize, false);
  // some phones never send a resize when the browser bars hide: look again twice a second (very cheap)
  setInterval(function(){ var v = viewSize(); if (v.w !== WIDTH || v.h !== HEIGHT) handleWindowResize(); }, 500);
}

// MOUSE AND SCREEN EVENTS

function handleWindowResize() {
  var vs = viewSize();
  HEIGHT = vs.h;
  WIDTH = vs.w;
  renderer.setSize(WIDTH, HEIGHT);
  aspectRatio = camera.aspect = WIDTH / HEIGHT; updateXS();
  camera.updateProjectionMatrix();
}

// ---------- INPUT ----------
// Mouse: absolute (the plane follows the pointer).
// Touch: RELATIVE drag. Put a thumb anywhere and slide: the plane moves by the amount you slide, so your thumb never hides the plane,
// there is no jump when you touch down, and a small thumb movement covers the whole height. Hold the on-screen buttons for fine moves.
var lastTouchT = 0, steer = null;
function onPad(t){ return false; }
function clamp1(v){ return Math.max(-1, Math.min(1, v)); }

function handleMouseMove(event) {
  if (Date.now() - lastTouchT < 900) return;          // browsers fire fake mouse events after a tap: ignore them
  if (window.VF) VF.touching = false;
  var tx = -1 + (event.clientX / WIDTH)*2;
  var ty = 1 - (event.clientY / HEIGHT)*2;
  mousePos = {x:tx, y:ty};
}

function handleTouchStart(e){
  lastTouchT = Date.now(); if (window.VF) VF.touching = true;
  if (game.status!="playing" || steer) return;
  for (var i=0;i<e.changedTouches.length;i++){
    var t = e.changedTouches[i];
    if (!onPad(t.target)){ steer = {id:t.identifier, px:t.clientX, py:t.clientY, mx:mousePos.x, my:mousePos.y}; break; }
  }
}

function handleTouchMove(e){
  lastTouchT = Date.now();
  if (game.status!="playing") return;
  e.preventDefault();                                   // no scrolling / pull-to-refresh while flying
  if (!steer) return;
  var t = null;
  for (var i=0;i<e.touches.length;i++){ if (e.touches[i].identifier===steer.id){ t = e.touches[i]; break; } }
  if (!t) return;
  var ry = Math.max(170, Math.min(300, HEIGHT*.38)),   // finger travel (px) that covers the full height
      rx = Math.max(200, Math.min(380, WIDTH*.45));    // horizontal travel is gentler: it only changes speed
  mousePos = {x: clamp1(steer.mx + (t.clientX-steer.px)*2/rx), y: clamp1(steer.my - (t.clientY-steer.py)*2/ry)};
}

function handleTouchEnd(e){
  lastTouchT = Date.now();
  if (!steer) return;
  for (var i=0;i<e.changedTouches.length;i++){ if (e.changedTouches[i].identifier===steer.id){ steer = null; break; } }
}

function handleMouseUp(event){}

// LIGHTS

var ambientLight, hemisphereLight, shadowLight, rimLight;

function createLights() {

  hemisphereLight = new THREE.HemisphereLight(0xaaaaaa,0x000000, .9)

  ambientLight = new THREE.AmbientLight(0xdc8874, .5);

  shadowLight = new THREE.DirectionalLight(0xffffff, .9);
  shadowLight.position.set(90, 380, 170);
  shadowLight.castShadow = true;
  shadowLight.shadow.camera.left = -460;
  shadowLight.shadow.camera.right = 460;
  shadowLight.shadow.camera.top = 460;
  shadowLight.shadow.camera.bottom = -460;
  shadowLight.shadow.camera.near = 1;
  shadowLight.shadow.camera.far = 1100;
  shadowLight.shadow.bias = -0.0006;
  shadowLight.shadow.mapSize.width = isMobile?1024:2048;
  shadowLight.shadow.mapSize.height = isMobile?1024:2048;

  // a weak cool light from behind/below the camera lifts the shaded side of the plane (looks less flat)
  rimLight = new THREE.DirectionalLight(0xbfd8ff, .22);
  rimLight.position.set(-200, 60, 260);

  scene.add(hemisphereLight);
  scene.add(shadowLight);
  scene.add(rimLight);
  scene.add(ambientLight);

}


var Pilot = function(){
  this.mesh = new THREE.Object3D();
  this.mesh.name = "pilot";
  this.angleHairs=0;

  var bodyGeom = new THREE.BoxGeometry(15,15,15);
  var bodyMat = new THREE.MeshPhongMaterial({color:Colors.brown, shading:THREE.FlatShading});
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(2,-12,0);

  this.mesh.add(body);

  var faceGeom = new THREE.BoxGeometry(10,10,10);
  var faceMat = new THREE.MeshLambertMaterial({color:Colors.pink});
  var face = new THREE.Mesh(faceGeom, faceMat);
  this.mesh.add(face);

  var hairGeom = new THREE.BoxGeometry(4,4,4);
  var hairMat = new THREE.MeshLambertMaterial({color:Colors.brown});
  var hair = new THREE.Mesh(hairGeom, hairMat);
  hair.geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,2,0));
  var hairs = new THREE.Object3D();

  this.hairsTop = new THREE.Object3D();

  for (var i=0; i<12; i++){
    var h = hair.clone();
    var col = i%3;
    var row = Math.floor(i/3);
    var startPosZ = -4;
    var startPosX = -4;
    h.position.set(startPosX + row*4, 0, startPosZ + col*4);
    h.geometry.applyMatrix(new THREE.Matrix4().makeScale(1,1,1));
    this.hairsTop.add(h);
  }
  hairs.add(this.hairsTop);

  var hairSideGeom = new THREE.BoxGeometry(12,4,2);
  hairSideGeom.applyMatrix(new THREE.Matrix4().makeTranslation(-6,0,0));
  var hairSideR = new THREE.Mesh(hairSideGeom, hairMat);
  var hairSideL = hairSideR.clone();
  hairSideR.position.set(8,-2,6);
  hairSideL.position.set(8,-2,-6);
  hairs.add(hairSideR);
  hairs.add(hairSideL);

  var hairBackGeom = new THREE.BoxGeometry(2,8,10);
  var hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(-1,-4,0)
  hairs.add(hairBack);
  hairs.position.set(-5,5,0);

  this.mesh.add(hairs);

  var glassGeom = new THREE.BoxGeometry(5,5,5);
  var glassMat = new THREE.MeshLambertMaterial({color:Colors.brown});
  var glassR = new THREE.Mesh(glassGeom,glassMat);
  glassR.position.set(6,0,3);
  var glassL = glassR.clone();
  glassL.position.z = -glassR.position.z
  var glassAGeom = new THREE.BoxGeometry(11,1,11);
  var glassA = new THREE.Mesh(glassAGeom, glassMat);
  this.mesh.add(glassR);
  this.mesh.add(glassL);
  this.mesh.add(glassA);

  var earGeom = new THREE.BoxGeometry(2,3,2);
  var earL = new THREE.Mesh(earGeom,faceMat);
  earL.position.set(0,0,-6);
  var earR = earL.clone();
  earR.position.set(0,0,6);
  this.mesh.add(earL);
  this.mesh.add(earR);
}

Pilot.prototype.updateHairs = function(){
   var hairs = this.hairsTop.children;
   var l = hairs.length;
   for (var i=0; i<l; i++){
      var h = hairs[i];
      h.scale.y = .75 + Math.cos(this.angleHairs+i/3)*.25;
   }
  this.angleHairs += game.speed*deltaTime*40;
}

// ---------- OBSTACLES (red spikes), BLUE PILLS, FUEL ----------
// Everything sits at the plane's depth (z = 0) and slides left along the flat world.
// 7 height lanes cover the WHOLE flight range (plane flies between y=20 and y=180), so no altitude is ever a safe hiding place.
var LANES = 7;
function laneY(i){ return 22 + i*26; }
function clampLane(l){ return Math.max(0, Math.min(LANES-1, l)); }
// is there room (no obstacle) around this height near the spawn point? used to place pills / fuel away from danger
function laneClear(y, reach, x0, x1){
  var list = ennemiesHolder.ennemiesInUse;
  for (var i=0;i<list.length;i++){ var e = list[i]; if (e.x > x0 && e.x < x1 && Math.abs((e.seek ? e.y : e.y0) - y) < reach) return false; }
  return true;
}

Ennemy = function(){
  var geom = new THREE.TetrahedronGeometry(8,2);
  var mat = new THREE.MeshPhongMaterial({
    color:Colors.red,
    emissive:0x3a0c08,
    shininess:40,
    specular:0xffb0a0,
    shading:THREE.FlatShading
  });
  this.mesh = new THREE.Mesh(geom,mat);
  this.mesh.castShadow = true;
  this.x = 0; this.y = 0; this.y0 = 0; this.seek = false; this.locked = false; this.bob = 0; this.ph = 0; this.minD = 999; this.passed = false;
}
// reset a pooled spike to a normal red one, or to an orange homing "seeker"
Ennemy.prototype.setKind = function(seek){
  this.seek = seek; this.locked = false; this.bob = 0;
  var m = this.mesh.material;
  m.color.setHex(seek ? 0xff8a1f : Colors.red); m.emissive.setHex(seek ? 0x6a3000 : 0x3a0c08);
  var sc = seek ? 1.3 : 1; this.mesh.scale.set(sc,sc,sc);
}

EnnemiesHolder = function (){
  this.mesh = new THREE.Object3D();
  this.ennemiesInUse = [];
}

EnnemiesHolder.prototype.add = function(x, y, seek){
  var ennemy = ennemiesPool.length ? ennemiesPool.pop() : new Ennemy();
  ennemy.setKind(!!seek);
  ennemy.x = x; ennemy.y = y; ennemy.y0 = y; ennemy.minD = 999; ennemy.passed = false;
  ennemy.mesh.position.set(x, y, 0);
  this.mesh.add(ennemy.mesh);
  this.ennemiesInUse.push(ennemy);
  return ennemy;
}

// Homing spikes: they appear at the plane's CURRENT height and follow it, locking on shortly before impact.
// Sitting still (at the top, the bottom or anywhere) gets you hit, you have to keep moving.
EnnemiesHolder.prototype.spawnSeekers = function(n){
  var py = airplane.mesh.position.y;
  for (var k=0;k<n;k++){
    var y = Math.max(18, Math.min(182, py + (k ? (Math.random()<.5 ? -1 : 1)*30 : 0)));
    this.add(SPAWN_X + k*70*XS, y, true);
  }
}

// ---------- THE DIRECTOR: decides when, what and where to spawn ----------
// 1. Fair timing: waves never come closer than ~0.8 s apart (more on touch), however fast you fly.
// 2. Reachable gates: the gap in each wave moves only as far as the plane can follow in the time available, and follows readable
//    "phrases" (stairs, zig-zag, free) so there is a rhythm to learn instead of noise.
// 3. Adaptive: do well and waves get fuller, get hit and the next ones ease off (game.dda between .7 and 1.3).
// 4. Aware: spikes avoid pills and fuel cans, a breather follows every wall/comb/homing spike, and standing still is punished.
function touchy(){ return (typeof isMobile !== 'undefined' && isMobile) || !!(window.VF && VF.touching); }
function waveGapDistance(){
  var minMs = touchy() ? 950 : 780;                                             // minimum time between waves
  var minD = minMs * Math.max(game.speed, .0003) * 50;                          // distance flown in that time (distance += speed*ms*50)
  return Math.max(game.distanceForEnnemiesSpawn / Math.max(.8, Math.min(1.25, game.dda)), minD);
}
function pickupNear(x, y){
  var i, c = coinsHolder.coinsInUse, f = fuelHolder.inUse;
  for (i=0;i<c.length;i++) if (Math.abs(c[i].x - x) < 55*XS+10 && Math.abs(c[i].y - y) < 24) return true;
  for (i=0;i<f.length;i++) if (Math.abs(f[i].x - x) < 55*XS+10 && Math.abs(f[i].y - y) < 28) return true;
  return false;
}
function nextGate(step){
  var s0 = game.safeLane, p = game.gatePlan, t = s0;
  if (!p || p.left <= 0){
    var r = Math.random();
    p = game.gatePlan = r < .4 ? {kind:'stairs', dir:(Math.random()<.5 ? 1 : -1), left:3 + Math.floor(Math.random()*3)}
      : r < .7 ? {kind:'zig', dir:(Math.random()<.5 ? 1 : -1), left:4}
      : {kind:'free', dir:0, left:2 + Math.floor(Math.random()*3)};
  }
  p.left--;
  if (p.kind === 'stairs'){ t = s0 + p.dir; if (t < 0 || t >= LANES){ p.dir = -p.dir; t = s0 + p.dir; } }
  else if (p.kind === 'zig'){ t = s0 + p.dir*Math.min(step,2); p.dir = -p.dir; if (t < 0 || t >= LANES) t = s0 + (s0 - t); }
  else t = s0 + Math.floor(Math.random()*(step*2+1)) - step;
  return clampLane(t);
}

EnnemiesHolder.prototype.spawnEnnemies = function(){
  game.waveN++; game.sinceSeek++;
  var lvl = game.level, skill = Math.max(.7, Math.min(1.3, game.dda));
  // learn by doing: the dda rises while you play clean, falls when you are hit
  if (!game.hitSinceWave) game.dda = Math.min(1.3, game.dda + .025);
  game.hitSinceWave = false;
  var seekGap = lvl < 3 ? 5 : 4;
  if (game.waveN >= 3 && (game.forceSeek || (game.waveN >= 6 && game.sinceSeek >= seekGap && game.lastKind !== 'wall'))){
    game.forceSeek = false; game.idleMs = 0; game.sinceSeek = 0; game.lastKind = 'seek';
    this.spawnSeekers(lvl >= 6 && skill > 1 && Math.random() < .5 ? 2 : 1);
    return;
  }
  var gapMs = waveGapDistance() / (Math.max(game.speed, .0003)*50);
  var step = (gapMs < 560 || (touchy() && lvl < 5) || lvl < 3) ? 1 : 2;
  var s = nextGate(step);
  game.safeLane = s;
  var rest = (game.lastKind === 'wall' || game.lastKind === 'comb' || game.lastKind === 'seek');   // breather after a hard wave
  var r = Math.random(), kind = 'scatter', i, lane;
  if (lvl >= 2 && !rest){
    var wallP = .2 + .08*(skill - 1)/.3;
    kind = r < wallP ? 'wall' : (r < wallP + .18 && s % 2 === 1) ? 'comb' : 'scatter';
  }
  game.lastKind = kind;
  if (kind === 'wall'){
    var gate2 = (lvl < 5 || skill < .9) ? (s < LANES-1 ? s+1 : s-1) : -1;       // early on (or when struggling) the gate is two lanes wide
    for (lane=0; lane<LANES; lane++){ if (lane!==s && lane!==gate2) this.add(SPAWN_X, laneY(lane), false); }
  } else if (kind === 'comb'){
    for (lane=0; lane<LANES; lane+=2) this.add(SPAWN_X, laneY(lane), false);
  } else {
    var n = Math.round((2 + lvl*.5) * skill) - (rest ? 1 : 0);
    n = Math.max(2, Math.min(touchy() ? 4 : 5, n));
    var used = {};
    for (i=0; i<n; i++){
      var tries = 0, x = SPAWN_X + i*60*XS;
      do { lane = Math.floor(Math.random()*LANES); tries++; } while ((lane===s || used[lane] || pickupNear(x, laneY(lane))) && tries < 12);
      if (lane===s || used[lane] || pickupNear(x, laneY(lane))) continue;
      used[lane] = 1;
      var e = this.add(x, laneY(lane), false);
      if (lvl >= 3 && Math.abs(lane-s) >= 2 && Math.random() < .35*skill){ e.bob = 12 + Math.random()*8; e.ph = Math.random()*6.28; }
    }
  }
}

EnnemiesHolder.prototype.rotateEnnemies = function(){
  for (var i=0; i<this.ennemiesInUse.length; i++){
    var ennemy = this.ennemiesInUse[i];
    var mult = ennemy.seek ? 1.15 : 1;
    ennemy.x -= dxFrame*game.ennemiesSpeed*mult;
    ennemy.mesh.position.x = ennemy.x;
    if (ennemy.seek && !ennemy.locked && game.status=="playing"){
      // follow the plane's height until about 0.42 s before impact, then lock on (so a late dodge still works)
      var vx = deltaTime > 0 ? dxFrame*game.ennemiesSpeed*mult/deltaTime : 0;
      if (vx > .0001 && (ennemy.x - airplane.mesh.position.x)/vx > 420) ennemy.y += (airplane.mesh.position.y - ennemy.y)*Math.min(1, deltaTime*.006);
      else ennemy.locked = true;
      ennemy.mesh.position.y = ennemy.y;
      if (Math.random() < .35) emitPuff(ennemy.x + 8, ennemy.y, 2);
    } else if (ennemy.bob){
      ennemy.y = ennemy.y0 + Math.sin(newTime*.0035 + ennemy.ph)*ennemy.bob;
      ennemy.mesh.position.y = ennemy.y;
    }
    ennemy.mesh.rotation.z += Math.random()*.1;
    ennemy.mesh.rotation.y += Math.random()*.1;

    var diffPos = airplane.mesh.position.clone().sub(ennemy.mesh.position);
    var d = diffPos.length();
    var tolE = game.ennemyDistanceTolerance*(ennemy.seek ? 1.15 : 1);
    if (game.status=="playing"){
      if (d < ennemy.minD) ennemy.minD = d;
      // close call: it passed the plane without a hit but only just
      if (!ennemy.passed && ennemy.x < airplane.mesh.position.x - 6){ ennemy.passed = true; if (ennemy.minD >= tolE && ennemy.minD < tolE + 7) VF.onNearMiss(); }
    }
    if (d<tolE && game.status=="playing"){
      particlesHolder.spawnParticles(ennemy.mesh.position.clone(), 15, ennemy.seek ? 0xff8a1f : Colors.red, 3);

      ennemiesPool.unshift(this.ennemiesInUse.splice(i,1)[0]);
      this.mesh.remove(ennemy.mesh);
      game.planeCollisionSpeedX = 100 * diffPos.x / d;
      game.planeCollisionSpeedY = 100 * diffPos.y / d;
      ambientLight.intensity = 2;

      addDamage(); VF.onHit(); hitFlash();
      game.hitSinceWave = true; game.dda = Math.max(.7, game.dda - .12);
      i--;
    }else if (ennemy.x < DESPAWN_X){
      ennemiesPool.unshift(this.ennemiesInUse.splice(i,1)[0]);
      this.mesh.remove(ennemy.mesh);
      i--;
    }
  }
}

function hitFlash(){
  var f = document.getElementById('flash'); if (!f) return;
  f.className = ''; void f.offsetWidth; f.className = 'hit';
}

Particle = function(){
  var geom = new THREE.TetrahedronGeometry(3,0);
  var mat = new THREE.MeshPhongMaterial({
    color:0x009999,
    shininess:0,
    specular:0xffffff,
    shading:THREE.FlatShading
  });
  this.mesh = new THREE.Mesh(geom,mat);
}

Particle.prototype.explode = function(pos, color, scale){
  var _this = this;
  var _p = this.mesh.parent;
  this.mesh.material.color = new THREE.Color( color);
  this.mesh.material.needsUpdate = true;
  this.mesh.scale.set(scale, scale, scale);
  var targetX = pos.x + (-1 + Math.random()*2)*50;
  var targetY = pos.y + (-1 + Math.random()*2)*50;
  var speed = .6+Math.random()*.2;
  TweenMax.to(this.mesh.rotation, speed, {x:Math.random()*12, y:Math.random()*12});
  TweenMax.to(this.mesh.scale, speed, {x:.1, y:.1, z:.1});
  TweenMax.to(this.mesh.position, speed, {x:targetX, y:targetY, delay:Math.random() *.1, ease:Power2.easeOut, onComplete:function(){
      if(_p) _p.remove(_this.mesh);
      _this.mesh.scale.set(1,1,1);
      particlesPool.unshift(_this);
    }});
}

ParticlesHolder = function (){
  this.mesh = new THREE.Object3D();
}

ParticlesHolder.prototype.spawnParticles = function(pos, density, color, scale){
  var nPArticles = density;
  for (var i=0; i<nPArticles; i++){
    var particle;
    if (particlesPool.length) {
      particle = particlesPool.pop();
    }else{
      particle = new Particle();
    }
    this.mesh.add(particle.mesh);
    particle.mesh.visible = true;
    particle.mesh.position.y = pos.y;
    particle.mesh.position.x = pos.x;
    particle.explode(pos,color, scale);
  }
}

Coin = function(){
  var geom = new THREE.TetrahedronGeometry(5,0);
  var mat = new THREE.MeshPhongMaterial({
    color:0x009999,
    emissive:0x00383a,
    shininess:90,
    specular:0xcffffa,
    shading:THREE.FlatShading
  });
  this.mesh = new THREE.Mesh(geom,mat);
  this.mesh.castShadow = true;
  this.x = 0; this.y = 0;
}

CoinsHolder = function (nCoins){
  this.mesh = new THREE.Object3D();
  this.coinsInUse = [];
  this.coinsPool = [];
  for (var i=0; i<nCoins; i++){
    var coin = new Coin();
    this.coinsPool.push(coin);
  }
}

CoinsHolder.prototype.spawnCoins = function(){

  var nCoins = 1 + Math.floor(Math.random()*10);
  // pills are not always in the safe lane any more: half of the trails sweep a random height with a big wave, so you must move to get them
  var lane = game.safeLane, amplitude = 8 + Math.round(Math.random()*5);
  if (Math.random() < .5){
    var cand = Math.floor(Math.random()*LANES), amp = 12 + Math.round(Math.random()*26);
    if (laneClear(laneY(cand), amp + 26, SPAWN_X - 90*XS, SPAWN_X + 220*XS)){ lane = cand; amplitude = amp; }
  }
  var d = laneY(lane);
  for (var i=0; i<nCoins; i++){
    var coin;
    if (this.coinsPool.length) {
      coin = this.coinsPool.pop();
    }else{
      coin = new Coin();
    }
    this.mesh.add(coin.mesh);
    this.coinsInUse.push(coin);
    coin.x = SPAWN_X + i*14*XS;
    coin.y = Math.max(16, Math.min(184, d + Math.cos(i*.5)*amplitude));
    coin.mesh.position.set(coin.x, coin.y, 0);
  }
}

CoinsHolder.prototype.rotateCoins = function(){
  for (var i=0; i<this.coinsInUse.length; i++){
    var coin = this.coinsInUse[i];
    coin.x -= dxFrame*game.coinsSpeed;
    coin.mesh.position.x = coin.x;
    coin.mesh.rotation.z += Math.random()*.1;
    coin.mesh.rotation.y += Math.random()*.1;

    var diffPos = airplane.mesh.position.clone().sub(coin.mesh.position);
    var d = diffPos.length();
    if (d<game.coinDistanceTolerance*(window.VF && VF.touching ? 1.2 : 1) && game.status=="playing"){
      this.coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
      this.mesh.remove(coin.mesh);
      particlesHolder.spawnParticles(coin.mesh.position.clone(), 5, 0x009999, .8);
      repairDamage(); VF.onCoin();
      i--;
    }else if (coin.x < DESPAWN_X){
      this.coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
      this.mesh.remove(coin.mesh);
      i--;
    }
  }
}


Fuel = function(){
  this.mesh = new THREE.Object3D();
  var mat = new THREE.MeshPhongMaterial({color:0xf4a63a, emissive:0x7a4a00, shininess:60, specular:0xffe0a0, shading:THREE.FlatShading});
  var body = new THREE.Mesh(new THREE.BoxGeometry(10,13,6), mat);
  var cap = new THREE.Mesh(new THREE.BoxGeometry(4,3,3), new THREE.MeshPhongMaterial({color:Colors.brownDark, shading:THREE.FlatShading}));
  cap.position.set(-2,8,0);
  var stripe = new THREE.Mesh(new THREE.BoxGeometry(10.5,3,6.5), new THREE.MeshPhongMaterial({color:Colors.white, shading:THREE.FlatShading}));
  this.mesh.add(body); this.mesh.add(cap); this.mesh.add(stripe);
  body.castShadow = true;
  this.mesh.scale.set(1.5,1.5,1.5);
  this.x = 0; this.y = 0;
}
FuelHolder = function(){ this.mesh = new THREE.Object3D(); this.inUse = []; this.pool = []; }
FuelHolder.prototype.spawn = function(){
  var f = this.pool.length ? this.pool.pop() : new Fuel();
  var fl = game.safeLane;
  if (Math.random() < .6){ var c = Math.floor(Math.random()*LANES); if (laneClear(laneY(c), 40, SPAWN_X - 90*XS, SPAWN_X + 120*XS)) fl = c; }
  f.x = SPAWN_X; f.y = laneY(fl);
  f.mesh.position.set(f.x, f.y, 0);
  this.mesh.add(f.mesh); this.inUse.push(f);
}
FuelHolder.prototype.rotate = function(){
  for (var i=0; i<this.inUse.length; i++){
    var f = this.inUse[i];
    f.x -= dxFrame*game.coinsSpeed;
    f.mesh.position.x = f.x;
    f.mesh.rotation.y += .05;
    var d = airplane.mesh.position.clone().sub(f.mesh.position).length();
    if (game.status=="playing" && d < game.coinDistanceTolerance*1.8){
      game.fuel = Math.min(100, game.fuel + game.fuelValue); guardFuel = game.fuel;
      particlesHolder.spawnParticles(f.mesh.position.clone(), 10, 0xf4a63a, 1);
      VF.onFuel();
    } else if (f.x > DESPAWN_X) continue;
    this.pool.push(this.inUse.splice(i,1)[0]); this.mesh.remove(f.mesh); i--;
  }
}
var fuelHolder, fuelBar;
function createFuel(){ fuelHolder = new FuelHolder(); scene.add(fuelHolder.mesh); }
function updateFuel(dd){
  if (game.fuel > guardFuel + .001) VF.cheat('fuel');
  game.fuel -= dd*(game.fuelBase + Math.min(game.level,12)*game.fuelPerLevel)*game.fuelEff;
  game.fuel = Math.max(0, game.fuel); guardFuel = game.fuel;
  fuelBar.style.right = (100-game.fuel)+"%";
  fuelBar.style.backgroundColor = (game.fuel<30)? "#f25346" : "#f4a63a";
  fuelBar.style.animationName = (game.fuel<30)? "blinking" : "none";
  if (game.fuel<=0 && game.status=="playing") endRun("Out of fuel!");
}

// ---------- SMOKE + FIRE (a damaged plane trails smoke, a nearly dead one burns) and jet exhaust ----------
var Puffs = {root:null, pool:[], act:[], t:0};
function createPuffs(){
  Puffs.root = new THREE.Object3D(); scene.add(Puffs.root);
  var geom = new THREE.IcosahedronGeometry(3, 0);
  for (var i=0;i<46;i++){
    var m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({color:0x888888, transparent:true, opacity:.6, fog:true, depthWrite:false}));
    m.visible = false; Puffs.root.add(m); Puffs.pool.push({m:m, x:0, y:0, vy:0, life:0, max:1, s0:1, s1:2, a:.6});
  }
}
function emitPuff(x, y, kind){
  var p = Puffs.pool.pop(); if (!p) return;
  var col, life, s0, s1, vy, a;
  if (kind === 2){ col = Math.random() < .5 ? 0xff7a1a : 0xffc23a; life = 380; s0 = .8; s1 = 1.8; vy = .02; a = .9; }      // fire
  else if (kind === 1){ col = 0x2c2c30; life = 900; s0 = .9; s1 = 3.6; vy = .035; a = .62; }                             // dark smoke
  else if (kind === 3){ col = 0xffffff; life = 700; s0 = .5; s1 = 1.9; vy = .004; a = .4; }                              // jet contrail
  else { col = 0xb8b8bc; life = 800; s0 = .8; s1 = 3; vy = .03; a = .5; }                                                  // light smoke
  p.m.material.color.setHex(col); p.m.material.opacity = a; p.a = a;
  p.x = x + (Math.random()-.5)*3; p.y = y + (Math.random()-.5)*3; p.vy = vy; p.life = p.max = life; p.s0 = s0; p.s1 = s1;
  p.m.position.set(p.x, p.y, (Math.random()-.5)*4); p.m.scale.set(s0,s0,s0); p.m.visible = true; Puffs.act.push(p);
}
function updatePuffs(){
  for (var i=Puffs.act.length-1;i>=0;i--){
    var p = Puffs.act[i]; p.life -= deltaTime;
    if (p.life <= 0){ p.m.visible = false; Puffs.act.splice(i,1); Puffs.pool.push(p); continue; }
    var k = 1 - p.life/p.max;
    p.x -= dxFrame; p.y += p.vy*deltaTime;
    var s = p.s0 + (p.s1-p.s0)*k; p.m.scale.set(s,s,s);
    p.m.position.x = p.x; p.m.position.y = p.y; p.m.material.opacity = p.a*(1-k);
    p.m.rotation.x += .03; p.m.rotation.y += .02;
  }
}
function clearPuffs(){ while (Puffs.act.length){ var p = Puffs.act.pop(); p.m.visible = false; Puffs.pool.push(p); } }
var TRAIL_KINDS = {jet:1, rocket:1, stealth:1, bizjet:1, shuttle:1, interceptor:1, airliner:1};
function emitPlaneEffects(){
  Puffs.t += deltaTime;
  var dm = game.damage, step = dm >= 85 ? 45 : dm >= 65 ? 75 : dm >= 40 ? 130 : 0;
  var tx = airplane.mesh.position.x + airplane.tail*.25, ty = airplane.mesh.position.y;
  if (step && Puffs.t > step){
    Puffs.t = 0;
    emitPuff(tx, ty, dm >= 85 ? 2 : dm >= 65 ? 1 : 0);
    if (dm >= 85) emitPuff(tx, ty, 1);
  } else if (!step && TRAIL_KINDS[airplane.kind] && Puffs.t > 70){
    Puffs.t = 0; emitPuff(tx, ty, 3);
  }
}

// 3D Models
var airplane;
var particlesHolder, coinsHolder, ennemiesHolder;

// (re)builds the player's plane from the hangar choice. Called by vectofly.js whenever plane / paint changes.
function setPlaneModel(kind, spec, base){
  var old = airplane ? airplane.mesh : null;
  var a = PB.build(kind, spec, base);
  a.mesh.scale.set(.25,.25,.25);
  a.mesh.position.y = game.planeDefaultHeight;
  if (old){
    a.mesh.position.copy(old.position); a.mesh.rotation.copy(old.rotation);
    scene.remove(old);
    old.traverse(function(o){ if (o.geometry) o.geometry.dispose(); });
  }
  scene.add(a.mesh);
  airplane = a;
}

function createPlane(){ setPlaneModel('prop', null, '#f25346'); }

function createCoins(){
  coinsHolder = new CoinsHolder(20);
  scene.add(coinsHolder.mesh)
}

function createEnnemies(){
  for (var i=0; i<10; i++){
    var ennemy = new Ennemy();
    ennemiesPool.push(ennemy);
  }
  ennemiesHolder = new EnnemiesHolder();
  scene.add(ennemiesHolder.mesh)
}

function createParticles(){
  for (var i=0; i<10; i++){
    var particle = new Particle();
    particlesPool.push(particle);
  }
  particlesHolder = new ParticlesHolder();
  scene.add(particlesHolder.mesh)
}

function loop(){

  newTime = new Date().getTime();
  if (VF.paused){ oldTime=newTime; requestAnimationFrame(loop); return; }
  deltaTime = Math.min(newTime-oldTime,50);
  oldTime = newTime;

  if (game.status=="playing"){

    if (game.distance-game.ennemyLastSpawn >= waveGapDistance()){ game.ennemyLastSpawn=game.distance; ennemiesHolder.spawnEnnemies(); }
    if (game.distance-game.coinLastSpawn >= game.distanceForCoinsSpawn){ game.coinLastSpawn=game.distance; coinsHolder.spawnCoins(); }
    if (game.distance-game.fuelLastSpawn >= game.distanceForFuelSpawn){ game.fuelLastSpawn=game.distance; fuelHolder.spawn(); }
    var lv = 1+Math.floor(game.distance/game.distanceForLevelUpdate);
    if (lv>game.level){ game.level=lv; fieldLevel.innerHTML=lv; game.distanceForEnnemiesSpawn=Math.max(game.spawnMin, game.spawnStart - game.spawnStep*lv); game.distanceForFuelSpawn=Math.max(330,450-5*lv); VF.onLevel(lv); }
    // endless Chrome-dino style ramp: speed grows continuously with distance
    game.targetBaseSpeed = Math.min(game.maxBaseSpeed, game.initSpeed + game.distance*game.speedPerMeter);

    updatePlane();
    updateDistance();
    updateDamage();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
    game.speed = game.baseSpeed * game.planeSpeed;

  }else if(game.status=="gameover"){
    game.speed *= Math.pow(.985, deltaTime/16.7);
    airplane.mesh.rotation.z += (-Math.PI/2 - airplane.mesh.rotation.z)*.0006*deltaTime;
    airplane.mesh.rotation.x += 0.0004*deltaTime;
    game.planeFallSpeed *= Math.pow(1.04, deltaTime/16.7);
    airplane.mesh.position.y -= game.planeFallSpeed*deltaTime;
    if (Math.random() < .6) emitPuff(airplane.mesh.position.x, airplane.mesh.position.y, Math.random() < .5 ? 2 : 1);

    var gy = World.groundAt(airplane.mesh.position.x, 0) + 6;
    if (airplane.mesh.position.y <= gy){
      // impact: explosion, wreck stays on the ground and the world rolls to a stop
      airplane.mesh.position.y = gy;
      var ip = airplane.mesh.position.clone();
      particlesHolder.spawnParticles(ip, 30, 0xf4a63a, 4);
      particlesHolder.spawnParticles(ip, 22, 0xd6483b, 3.4);
      particlesHolder.spawnParticles(ip, 16, 0x2c2c30, 3);
      VF.onHit(); hitFlash();
      for (var q=0;q<10;q++) emitPuff(ip.x, ip.y + 2, q%3 ? 1 : 2);
      game.status = "crashed"; game.crashT = 0;
    }
  }else if (game.status=="crashed"){
    game.speed *= Math.pow(.94, deltaTime/16.7); game.crashT += deltaTime;
    if (Math.random() < .25) emitPuff(airplane.mesh.position.x, airplane.mesh.position.y + 3, Math.random() < .3 ? 2 : 1);
    if (game.crashT > 900){ showReplay(); game.status = "waitingReplay"; }
  }else if (game.status=="menu"){
    game.speed=.0005;
    airplane.mesh.position.y=game.planeDefaultHeight+Math.sin(newTime/400)*6;
  }else if (game.status=="waitingReplay"){
    game.speed *= Math.pow(.96, deltaTime/16.7);
  }

  dxFrame = game.speed*deltaTime*K_SCROLL*XS;
  World.update(dxFrame, deltaTime);

  airplane.propeller.rotation.x +=.2 + game.planeSpeed * deltaTime*.005;
  if (airplane.tick) airplane.tick(deltaTime);

  ambientLight.intensity += (.5 - ambientLight.intensity)*deltaTime*0.005;

  coinsHolder.rotateCoins();
  fuelHolder.rotate();
  ennemiesHolder.rotateEnnemies();
  updateWarn();

  if (game.status=="playing") emitPlaneEffects();
  updatePuffs();
  VF.onFrame();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateDistance(){
  var dd = game.speed*deltaTime*game.ratioSpeedDistance; game.distance += dd; VF.tick(dd, deltaTime); updateFuel(dd);
  fieldDistance.innerHTML = VF.score();
  var d = 502*(1-(game.distance%game.distanceForLevelUpdate)/game.distanceForLevelUpdate);
  levelCircle.setAttribute("stroke-dashoffset", d);
}

// ---------- DAMAGE ----------
// Red spikes add damage, blue pills repair it. At 100 damage the plane is destroyed.
function updateDamage(){
  if (Math.abs(game.damage - guardDamage) > .01) VF.cheat('damage');
  var dm = Math.min(100, Math.max(0, game.damage));
  damageBar.style.right = (100-dm)+"%";
  damageBar.style.backgroundColor = dm < 40 ? "#68c3c0" : dm < 70 ? "#f4a63a" : "#f25346";
  damageBar.style.animationName = dm > 70 ? "blinking" : "none";
  if (dm >= 100 && game.status=="playing") endRun("Crashed!");
}

// Integrity guards: damage / fuel may only change through the functions below. If something else edits them
// (console, injected script), the run is stopped and not submitted. The server re-checks every score anyway.
var guardDamage = 0, guardFuel = 100;
function repairDamage(){
  game.damage = Math.max(0, game.damage - game.coinValue); guardDamage = game.damage;
}

function addDamage(){
  game.damage = Math.min(100, game.damage + game.ennemyValue); guardDamage = game.damage;
}

function endRun(reason){
  if (game.status!="playing") return;
  game.reason = reason; game.status = "gameover"; game.planeFallSpeed = .001;
  VF.onGameOver();
}


// vertical field of view: wide screens keep the classic 46-72 degrees. Narrow screens use the angle that shows exactly the squeezed width
// (about 165*XS world units either side), so the plane and spikes stay big instead of being stretched by a huge fish-eye FOV.
function cameraFov(){
  var k = normalize(mousePos.x,-1,1,.8,1.2);
  if (aspectRatio >= 1.33) return normalize(mousePos.x,-1,1,46,72);
  var half = (165*XS)/aspectRatio, deg = 2*Math.atan(half/200)*180/Math.PI;
  return Math.max(40, Math.min(105, deg*k));
}

function updatePlane(){

  game.planeSpeed = normalize(mousePos.x,-.5,.5,game.planeMinSpeed, game.planeMaxSpeed);
  var targetY = normalize(mousePos.y,-.75,.75,game.planeDefaultHeight-game.planeAmpHeight, game.planeDefaultHeight+game.planeAmpHeight);
  var targetX = normalize(mousePos.x,-1,1,-game.planeAmpWidth*.7*XS, -game.planeAmpWidth*XS);

  game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
  targetX += game.planeCollisionDisplacementX;


  game.planeCollisionDisplacementY += game.planeCollisionSpeedY;
  targetY += game.planeCollisionDisplacementY;

  var sens = game.planeMoveSensivity * ((window.VF && VF.touching) ? 1.8 : 1);   // touch: quicker response
  airplane.mesh.position.y += (targetY-airplane.mesh.position.y)*deltaTime*sens;
  airplane.mesh.position.x += (targetX-airplane.mesh.position.x)*deltaTime*sens;

  airplane.mesh.rotation.z = (targetY-airplane.mesh.position.y)*deltaTime*game.planeRotXSensivity;
  airplane.mesh.rotation.x = (airplane.mesh.position.y-targetY)*deltaTime*game.planeRotZSensivity;
  // a badly damaged plane shudders
  if (game.damage > 60){ var j = (game.damage-60)/40*.05; airplane.mesh.rotation.z += (Math.random()-.5)*j; airplane.mesh.rotation.x += (Math.random()-.5)*j; }
  camera.fov = cameraFov();
  camera.updateProjectionMatrix ()
  camera.position.y += (airplane.mesh.position.y - camera.position.y)*deltaTime*game.cameraSensivity;

  game.planeCollisionSpeedX += (0-game.planeCollisionSpeedX)*deltaTime * 0.03;
  game.planeCollisionDisplacementX += (0-game.planeCollisionDisplacementX)*deltaTime *0.01;
  game.planeCollisionSpeedY += (0-game.planeCollisionSpeedY)*deltaTime * 0.03;
  game.planeCollisionDisplacementY += (0-game.planeCollisionDisplacementY)*deltaTime *0.01;

  airplane.pilot.updateHairs();

  // standing still (same height for ~2.5 s) calls in a homing spike
  if (Math.abs(airplane.mesh.position.y - game.idleY) < 7) game.idleMs += deltaTime; else { game.idleY = airplane.mesh.position.y; game.idleMs = 0; }
  if (game.idleMs > 2500) game.forceSeek = true;
}

// red "!" at the right edge, at the height of an incoming homing spike that is still off screen
var warnEl = null, warnV = null;
function updateWarn(){
  if (!warnEl) warnEl = document.getElementById('warn');
  if (!warnEl) return;
  var show = false, y = 0;
  if (game.status=="playing"){
    var list = ennemiesHolder.ennemiesInUse;
    for (var i=0;i<list.length;i++){
      var e = list[i]; if (!e.seek) continue;
      if (!warnV) warnV = new THREE.Vector3();
      warnV.copy(e.mesh.position).project(camera);
      if (warnV.x > .9 || warnV.z > 1){ show = true; y = Math.max(70, Math.min(HEIGHT-130, (1-warnV.y)/2*HEIGHT)); break; }
    }
  }
  if (show){ warnEl.style.top = Math.round(y-16)+'px'; if (warnEl.style.display!=='block') warnEl.style.display='block'; }
  else if (warnEl.style.display!=='none') warnEl.style.display='none';
}

function startGame(){
  resetGame(); VF.applyPerks(); guardDamage = 0; guardFuel = 100; mousePos = {x:0, y:0}; steer = null;
  airplane.mesh.position.y=game.planeDefaultHeight; airplane.mesh.rotation.set(0,0,0);
  while(ennemiesHolder.ennemiesInUse.length){ var e=ennemiesHolder.ennemiesInUse.pop(); ennemiesHolder.mesh.remove(e.mesh); ennemiesPool.push(e); }
  while(fuelHolder.inUse.length){ var u=fuelHolder.inUse.pop(); fuelHolder.mesh.remove(u.mesh); fuelHolder.pool.push(u); }
  while(coinsHolder.coinsInUse.length){ var c=coinsHolder.coinsInUse.pop(); coinsHolder.mesh.remove(c.mesh); coinsHolder.coinsPool.push(c); }
  clearPuffs();
  damageBar.style.right = "100%"; damageBar.style.animationName = "none";
}

function showReplay(){
  VF.showGameOver();
}

function hideReplay(){

}

function normalize(v,vmin,vmax,tmin, tmax){
  var nv = Math.max(Math.min(v,vmax), vmin);
  var dv = vmax-vmin;
  var pc = (nv-vmin)/dv;
  var dt = tmax-tmin;
  var tv = tmin + (pc*dt);
  return tv;
}

var fieldDistance, damageBar, replayMessage, fieldLevel, levelCircle;

function init(event){

  // UI

  fieldDistance = document.getElementById("distValue");
  damageBar = document.getElementById("damageBar");
  fuelBar = document.getElementById("fuelBar");
  replayMessage = document.getElementById("replayMessage");
  fieldLevel = document.getElementById("levelValue");
  levelCircle = document.getElementById("levelCircleStroke");

  resetGame();
  game.status="menu";
  createScene();

  createLights();
  World.init(scene);
  createPlane();
  createCoins();
  createEnnemies();
  createParticles();
  createFuel();
  createPuffs();

  document.addEventListener('mousemove', handleMouseMove, false);
  document.addEventListener('touchstart', handleTouchStart, {passive:true});
  document.addEventListener('touchmove', handleTouchMove, {passive:false});
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchend', handleTouchEnd, false);
  document.addEventListener('touchcancel', handleTouchEnd, false);

  loop();
}

window.addEventListener('load', init, false);
