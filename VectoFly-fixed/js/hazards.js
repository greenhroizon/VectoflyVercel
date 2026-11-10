// VectoFly - map hazards. Every map has its own threats on top of the red spikes:
// enemy fighters and alien saucers that shoot at you, bombers, meteors, bird flocks, lightning, lasers, fireballs,
// falling icicles and wind gusts. Loaded after game.js; game.js calls Hazards.init / reset / update.
// Every threat shows a warning first (a flashing muzzle, a red path, a ring on the sky) so it can always be dodged.
var Hazards = (function(){
  var root = null, list = [], nextAt = 0, lastKind = '', told = {}, G = {}, M = {};
  var TELL = {fighter:'ENEMY FIGHTER!', ufo:'ALIEN SAUCER!', bomber:'BOMBER OVERHEAD!', meteor:'METEORS!', lightning:'STORM STRIKE!',
              laser:'LASER GRID!', fireball:'FIREBALLS!', icicle:'FALLING ICE!', bird:'BIRDS AHEAD!', gust:'WIND GUST!'};
  var BIG = {fighter:1, ufo:1, bomber:1, meteor:1, lightning:1, laser:1, fireball:1};

  function R(a, b){ return a + Math.random()*(b - a); }
  function cl(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function P(){ return airplane.mesh.position; }
  function hz(){ return (window.VF && VF.hazMul) ? VF.hazMul() : 1; }
  function lvl(){ return game.level || 1; }
  function playing(){ return game.status === 'playing'; }

  // ---------- shared geometry / materials ----------
  function mat(c, o){ var k = c + JSON.stringify(o || {}); if (M[k]) return M[k]; var p = {color:c, shading:THREE.FlatShading}; if (o) for (var q in o) p[q] = o[q]; return M[k] = new THREE.MeshPhongMaterial(p); }
  function glowM(c, op){ return new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:op === undefined ? 1 : op, depthWrite:false}); }
  function mesh(geo, m, sx, sy, sz, x, y, z, parent){
    var o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(o); return o;
  }
  function bx(w, h, d, m, x, y, z, p){ return mesh(G.box, m, w, h, d, x, y, z, p); }
  function sp(sx, sy, sz, m, x, y, z, p){ return mesh(G.sph, m, sx, sy, sz, x, y, z, p); }
  function cy(r, len, m, x, y, z, p, ax){ var o = mesh(G.cyl, m, r, len, r, x, y, z, p); if (ax === 'x') o.rotation.z = -Math.PI/2; return o; }

  function init(){
    if (root) return;
    G.box = new THREE.BoxGeometry(1, 1, 1); G.sph = new THREE.SphereGeometry(1, 10, 8); G.cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    G.ico = new THREE.IcosahedronGeometry(1, 0); G.cone = new THREE.CylinderGeometry(0, 1, 1, 6); G.coneD = new THREE.CylinderGeometry(1, 0, 1, 5);
    G.ring = new THREE.RingGeometry(.82, 1, 32);
    root = new THREE.Object3D(); scene.add(root);
  }
  function add(e){ e.done = false; e.mesh.position.set(e.x || 0, e.y || 0, 0); root.add(e.mesh); list.push(e); return e; }
  function kill(e){ e.done = true; root.remove(e.mesh); if (e.dispose) e.dispose(); }
  function reset(){
    for (var i = 0; i < list.length; i++){ root.remove(list[i].mesh); if (list[i].dispose) list[i].dispose(); }
    list = []; nextAt = 240*hz(); lastKind = ''; if (typeof game !== 'undefined') game.windY = 0;
  }

  // ---------- hit handling ----------
  function near(x, y, r){ var p = P(); return Math.sqrt((p.x - x)*(p.x - x) + (p.y - y)*(p.y - y)) < r + 6; }
  function hurt(mult, x, y, col){
    if (!playing()) return;
    var p = P(), dx = p.x - x, dy = p.y - y, d = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    particlesHolder.spawnParticles(new THREE.Vector3(x, y, 0), 14, col || 0xff8a1f, 3);
    game.planeCollisionSpeedX = 80*dx/d; game.planeCollisionSpeedY = 80*dy/d;
    ambientLight.intensity = 2;
    game.damage = Math.min(100, game.damage + game.ennemyValue*mult); guardDamage = game.damage;
    VF.onHit(); hitFlash(); game.hitSinceWave = true; game.dda = Math.max(.7, game.dda - .06);
  }
  function tell(kind){
    if (told[kind]) return; told[kind] = 1;
    if (window.VF && VF.toast) VF.toast(TELL[kind] || 'DANGER!', '#ff6a5a');
  }
  function alarm(){ if (window.VF && VF.sfx) VF.sfx('warn'); }

  // ---------- bullets (fighters + saucers) ----------
  function bullet(x, y, vx, vy, col, size){
    var m = new THREE.Object3D();
    sp(size, size, size, glowM(col), 0, 0, 0, m); sp(size*1.9, size*1.9, size*1.9, glowM(0xffffff, .28), 0, 0, 0, m);
    var e = {kind:'bullet', mesh:m, x:x, y:y, vx:vx, vy:vy, minD:999, passed:false, r:size};
    e.step = function(dt){
      this.x += this.vx*dt; this.y += this.vy*dt; this.mesh.position.set(this.x, this.y, 0);
      if (Math.random() < .5) emitPuff(this.x - this.vx*14, this.y - this.vy*14, 2);
      if (playing()){
        var p = P(), dx = p.x - this.x, dy = p.y - this.y, d = Math.sqrt(dx*dx + dy*dy);
        if (d < this.minD) this.minD = d;
        if (d < this.r + 6){ hurt(.55, this.x, this.y, col); return true; }
        if (!this.passed && this.x < p.x - 4){ this.passed = true; if (this.minD < this.r + 17) VF.onNearMiss(); }
      }
      return this.x < -320 || this.x > 560 || this.y < -30 || this.y > 300;
    };
    return add(e);
  }
  function aimedBullet(mx, my, col, size, spread){
    var p = P(), T = (800 - Math.min(lvl(), 8)*24) * cl(hz()*.5 + .55, .85, 1.3);
    var dx = p.x - mx, dy = p.y - my, a = Math.atan2(dy, dx) + (spread || 0), d = Math.sqrt(dx*dx + dy*dy), v = d/T;
    bullet(mx, my, Math.cos(a)*v, Math.sin(a)*v, col, size);
  }

  // ---------- models ----------
  function fighterModel(){
    var g = new THREE.Object3D(), body = mat(0x4a4f5c), red = mat(0xc1272d), dark = mat(0x23190f);
    bx(36, 8, 8, body, 0, 0, 0, g); cy(4.2, 14, red, 24, 0, 0, g, 'x');
    var nose = mesh(G.cone, red, 4.5, 12, 4.5, 26, 0, 0, g); nose.rotation.z = -Math.PI/2;
    bx(14, 1.6, 46, red, 2, -1, 0, g); bx(9, 1.2, 18, red, -17, 0, 0, g); bx(9, 11, 1.6, red, -17, 6, 0, g);
    sp(7, 4, 4, mat(0x9fd8e8, {transparent:true, opacity:.6}), -2, 5, 0, g);
    var disc = mesh(G.cyl, glowM(0x23190f, .35), 10, .6, 10, 32, 0, 0, g); disc.rotation.z = Math.PI/2;
    g.rotation.y = Math.PI; return g;           // nose now points left, at you
  }
  function ufoModel(){
    var g = new THREE.Object3D();
    sp(17, 5, 17, mat(0x8fb4c8, {shininess:80}), 0, 0, 0, g); sp(9, 7, 9, mat(0x9fe8c8, {transparent:true, opacity:.65}), 0, 5, 0, g);
    sp(10, 2.4, 10, mat(0x4a5a78), 0, -3.5, 0, g);
    for (var i = 0; i < 6; i++){ var a = i/6*6.283; sp(1.5, 1.5, 1.5, glowM(i%2 ? 0xffe14a : 0x7dff6a), Math.cos(a)*15, 0, Math.sin(a)*15, g); }
    return g;
  }
  function bomberModel(){
    var g = new THREE.Object3D(), body = mat(0x4a5a3a), dark = mat(0x23190f);
    bx(50, 12, 12, body, 0, 0, 0, g); bx(16, 2.4, 76, body, 2, -1, 0, g); bx(10, 1.6, 26, body, -22, 1, 0, g); bx(10, 14, 2, body, -22, 8, 0, g);
    [20, -20].forEach(function(z){ cy(4.5, 16, dark, 6, -3, z, g, 'x'); cy(7, .7, glowM(0x23190f, .35), 15, -3, z, g, 'x'); });
    sp(9, 5, 5, mat(0x9fd8e8, {transparent:true, opacity:.6}), 14, 5, 0, g);
    cy(4, 8, mat(0xc1272d), 0, 0, 6.3, g); 
    g.rotation.y = Math.PI; return g;
  }
  function birdModel(col){
    var g = new THREE.Object3D(), body = mat(col);
    sp(5, 2.6, 2.6, body, 0, 0, 0, g); sp(2, 2, 2, body, 5, 1, 0, g); mesh(G.cone, mat(0xf2a23a), 1, 3, 1, 8, .8, 0, g).rotation.z = -Math.PI/2;
    var wl = bx(6, .7, 9, body, -.5, .4, 5.5, g), wr = bx(6, .7, 9, body, -.5, .4, -5.5, g);
    g.userData = {wl:wl, wr:wr}; g.rotation.y = Math.PI; return g;
  }
  function bombModel(){
    var g = new THREE.Object3D();
    sp(5.5, 3.4, 3.4, mat(0x2c2f36), 0, 0, 0, g); bx(1.6, 3.5, 3.6, mat(0xc1272d), 1.5, 0, 0, g);
    bx(3, 6.4, .8, mat(0x3a3f48), -5.5, 0, 0, g); bx(3, .8, 6.4, mat(0x3a3f48), -5.5, 0, 0, g);
    return g;
  }

  // ---------- 1. enemy fighter / alien saucer ----------
  function fighter(ufo){
    var m = ufo ? ufoModel() : fighterModel(), L = lvl(), p = P();
    m.scale.setScalar(Math.max(.75, XS));                 // a bit smaller on narrow phone screens
    var e = {kind:ufo ? 'ufo' : 'fighter', mesh:m, x:SPAWN_X + 40, y:cl(p.y + R(-45, 45), 48, 165), ph:'in', shots:0, cd:0,
             max:3 + (L >= 4 ? 1 : 0) + (L >= 8 ? 1 : 0), hold:Math.max(55, 115*XS), ty:p.y};
    var muz = sp(3.4, 3.4, 3.4, glowM(0xff3a2a, .95), ufo ? 0 : -27, ufo ? -9 : 0, 0, m); muz.visible = false;
    if (ufo) muz.position.set(0, -9, 0);
    e.step = function(dt){
      var q = P();
      if (this.ph === 'in'){ this.x -= .36*dt; if (this.x <= this.hold){ this.x = this.hold; this.ph = 'fight'; this.cd = 700*hz(); alarm(); } }
      else if (this.ph === 'fight'){
        this.ty = cl(q.y, 48, 165);
        this.y += cl((this.ty - this.y)*.002*dt, -.05*dt, .05*dt);
        this.cd -= dt;
        var charge = this.cd < 380 && this.cd > 0;
        muz.visible = charge; if (charge){ var k = 3 + Math.sin(newTime*.04)*1.2; muz.scale.set(k, k, k); }
        if (this.cd <= 0){
          muz.visible = false; this.shots++;
          var mx = this.x - (ufo ? 0 : 29), my = this.y - (ufo ? 9 : 0);
          if (ufo){ [-.2, 0, .2].forEach(function(s){ aimedBullet(mx, my, 0x7dff6a, 3.4, s); }); }
          else aimedBullet(mx, my, 0xffb02a, 3.2, 0);
          this.cd = (ufo ? 1250 : 880 - Math.min(L, 8)*25)*hz();
          if (this.shots >= this.max){ this.ph = 'out'; }
        }
      } else { this.x += .30*dt; this.y += .05*dt; if (this.x > SPAWN_X + 90) return true; }
      var tilt = cl((this.ty - this.y)*.012, -.35, .35);
      this.mesh.position.set(this.x + Math.sin(newTime*.004)*2, this.y + Math.sin(newTime*.006)*1.5, 0);
      if (ufo){ this.mesh.rotation.y += .004*dt; this.mesh.rotation.z = tilt*.5; } else this.mesh.rotation.z = tilt;
      return false;
    };
    return add(e);
  }

  // ---------- 2. bomber: carpet of bombs ----------
  function bomber(){
    var m = bomberModel(); m.scale.setScalar(Math.max(.75, XS));
    var L = lvl(), dir = Math.random() < .5 ? -1 : 1, vb = .27, g = .00055, p = P();
    var e = {kind:'bomber', mesh:m, x:dir < 0 ? SPAWN_X + 70 : -SPAWN_X - 70, y:192, dir:dir, drops:[]};
    if (dir > 0) m.rotation.y = 0;
    var n = 3 + (L >= 5 ? 1 : 0) + (L >= 9 ? 1 : 0), ys = [], tries = 0;
    while (ys.length < n && tries++ < 60){ var y = R(30, 150), ok = true; ys.forEach(function(v){ if (Math.abs(v - y) < 38) ok = false; }); if (ok) ys.push(y); }
    ys.forEach(function(y){ e.drops.push(Math.sqrt(2*(190 - y)/g)); });
    e.drops.sort(function(a, b){ return b - a; });             // lowest crossing first
    e.step = function(dt){
      var q = P(); this.x += this.dir*vb*dt;
      if (this.drops.length){
        var tc = this.drops[0];                                          // time this bomb needs to fall to the plane's height
        if ((this.dir < 0 && this.x <= q.x + vb*tc) || (this.dir > 0 && this.x >= q.x - vb*tc)){ this.drops.shift(); bomb(this.x, this.y - 6, this.dir*vb); }
      }
      this.mesh.position.set(this.x, this.y + Math.sin(newTime*.005)*1.2, 0);
      return (this.dir < 0 && this.x < -SPAWN_X - 90) || (this.dir > 0 && this.x > SPAWN_X + 90);
    };
    alarm(); return add(e);
  }
  function bomb(x, y, vx){
    var e = {kind:'bomb', mesh:bombModel(), x:x, y:y, vx:vx, vy:0};
    e.step = function(dt){
      this.vy -= .00055*dt; this.x += this.vx*dt; this.y += this.vy*dt;
      this.mesh.position.set(this.x, this.y, 0); this.mesh.rotation.z = Math.atan2(this.vy, this.vx);
      if (playing() && near(this.x, this.y, 5)){ hurt(1, this.x, this.y, 0xff8a1f); particlesHolder.spawnParticles(new THREE.Vector3(this.x, this.y, 0), 10, 0xf4a63a, 3); return true; }
      if (this.y < 6){ for (var i = 0; i < 4; i++) emitPuff(this.x + R(-6, 6), 8, i%2 ? 1 : 2); particlesHolder.spawnParticles(new THREE.Vector3(this.x, 8, 0), 8, 0xf4a63a, 2.4); return true; }
      return this.x < -330 || this.x > 560;
    };
    return add(e);
  }

  // ---------- 3. meteors ----------
  function meteor(delay, yAvoid){
    var T = (1500 - Math.min(lvl(), 8)*40)*cl(hz(), .85, 1.3), p = P();
    var yc = R(38, 160); if (yAvoid !== undefined && Math.abs(yc - yAvoid) < 40) yc = cl(yAvoid + (yc > yAvoid ? 45 : -45), 35, 165);
    var x0 = p.x + R(.09, .14)*T*Math.max(.55, XS), y0 = 232, vx = (p.x - x0)/T, vy = (yc - y0)/T, len = Math.sqrt((x0 - p.x)*(x0 - p.x) + (y0 - yc)*(y0 - yc))*1.5;
    var g = new THREE.Object3D(), rock = mesh(G.ico, mat(0x6a4a3a, {emissive:0x7a2a08}), 7, 7, 7, 0, 0, 0, g);
    var path = mesh(G.box, glowM(0xff3a2a, .1), len, 1.5, 1.5, 0, 0, 0, new THREE.Object3D());
    var pg = new THREE.Object3D(); pg.add(path); pg.position.set(x0 + vx*len*.35/Math.sqrt(vx*vx + vy*vy), y0 + vy*len*.35/Math.sqrt(vx*vx + vy*vy), 0); pg.rotation.z = Math.atan2(vy, vx); root.add(pg);
    var e = {kind:'meteor', mesh:g, x:x0, y:y0, wait:delay || 0, minD:999, passed:false, pg:pg, t:0};
    e.dispose = function(){ root.remove(this.pg); };
    e.mesh.visible = false;
    e.step = function(dt){
      this.t += dt; path.material.opacity = .12 + .3*Math.abs(Math.sin(this.t*.012));
      if (this.wait > 0){ this.wait -= dt; return false; }
      if (!this.mesh.visible){ this.mesh.visible = true; alarm(); }
      this.x += vx*dt; this.y += vy*dt; this.mesh.position.set(this.x, this.y, 0);
      rock.rotation.x += .01*dt; rock.rotation.y += .007*dt;
      if (Math.random() < .7) emitPuff(this.x - vx*10, this.y - vy*10, 2);
      if (playing()){
        var q = P(), d = Math.sqrt((q.x - this.x)*(q.x - this.x) + (q.y - this.y)*(q.y - this.y));
        if (d < this.minD) this.minD = d;
        if (d < 13){ hurt(1, this.x, this.y, 0xff7a2a); return true; }
        if (!this.passed && this.x < q.x - 6){ this.passed = true; root.remove(this.pg); if (this.minD < 24) VF.onNearMiss(); }
      }
      if (this.y < 6){ for (var i = 0; i < 4; i++) emitPuff(this.x, 8, i%2 ? 1 : 2); return true; }
      return this.x < -330;
    };
    return add(e);
  }

  // ---------- 4. bird flock ----------
  function birds(){
    var n = 3 + (lvl() >= 4 ? 1 : 0) + (lvl() >= 8 ? 1 : 0), y0 = R(44, 160), col = (window.VF && VF.birdColor) ? VF.birdColor() : 0xf2f2f2;
    for (var i = 0; i < n; i++){
      (function(i){
        var g = birdModel(col), ud = g.userData;
        var e = {kind:'bird', mesh:g, x:SPAWN_X + i*16 + R(0, 6), y:y0 + (i%2 ? 1 : -1)*Math.ceil(i/2)*9, ph:R(0, 6.28), minD:999, passed:false};
        e.step = function(dt){
          this.x -= dxFrame*1.45 + .03*dt; this.y += Math.sin(newTime*.004 + this.ph)*.012*dt;
          this.mesh.position.set(this.x, this.y, 0);
          var f = Math.sin(newTime*.02 + this.ph)*.7; ud.wl.rotation.x = f; ud.wr.rotation.x = -f;
          if (playing()){
            var q = P(), d = Math.sqrt((q.x - this.x)*(q.x - this.x) + (q.y - this.y)*(q.y - this.y));
            if (d < this.minD) this.minD = d;
            if (d < 11){ hurt(.5, this.x, this.y, col); return true; }
            if (!this.passed && this.x < q.x - 5){ this.passed = true; if (this.minD < 19) VF.onNearMiss(); }
          }
          return this.x < DESPAWN_X;
        };
        add(e);
      })(i);
    }
  }

  // ---------- 5. lightning strikes (a ring on the sky shows where) ----------
  function lightning(){
    var n = 1 + (lvl() >= 5 ? 1 : 0) + (lvl() >= 10 ? 1 : 0);
    for (var k = 0; k < n; k++) (function(k){
      var g = new THREE.Object3D(), ringM = glowM(0xffe14a, .6), ring = mesh(G.ring, ringM, 24, 24, 1, 0, 0, 0, g), colM = glowM(0xffe14a, .12);
      var col = mesh(G.box, colM, 3, 260, 1, 0, 0, 0, g);
      var e = {kind:'lightning', mesh:g, x:0, y:0, wait:k*430, ph:'wait', t:0, T:cl(900*hz(), 620, 1150)};
      e.mesh.visible = false;
      e.step = function(dt){
        if (this.wait > 0){ this.wait -= dt; return false; }
        if (this.ph === 'wait'){
          var q = P(); this.x = q.x; this.y = cl(q.y + (k ? (k%2 ? 1 : -1)*R(30, 55) : R(-10, 10)), 30, 172); this.ph = 'tele'; this.t = 0;
          this.mesh.visible = true; if (!k) alarm();
        }
        this.t += dt;
        if (this.ph === 'tele'){
          var s = 1 + .08*Math.sin(this.t*.03); ring.scale.set(24*s, 24*s, 1); ringM.opacity = .35 + .35*Math.abs(Math.sin(this.t*.02)); colM.opacity = .08 + .1*(this.t/this.T);
          this.mesh.position.set(this.x, this.y, 0);
          col.scale.y = 260 - this.y; col.position.y = (260 - this.y)/2;
          if (this.t >= this.T){
            this.ph = 'strike'; this.t = 0; ambientLight.intensity = 2.6; if (window.VF && VF.shake) VF.shake(10);
            ringM.color.setHex(0xffffff); ringM.opacity = 1; colM.color.setHex(0xffffff); colM.opacity = .9; col.scale.x = 5;
            if (playing() && near(this.x, this.y, 22)) hurt(1.1, this.x, this.y, 0xffe14a);
            for (var i = 0; i < 6; i++) emitPuff(this.x + R(-12, 12), this.y + R(-10, 10), 2);
          }
        } else {
          var f = 1 - this.t/260; ringM.opacity = f; colM.opacity = .9*f; ring.scale.set(24 + this.t*.06, 24 + this.t*.06, 1);
          if (this.t > 260) return true;
        }
        return false;
      };
      e.dispose = function(){ ringM.dispose(); colM.dispose(); };
      add(e);
    })(k);
  }

  // ---------- 6. laser beams across the whole sky ----------
  function laser(){
    var n = 1 + (lvl() >= 4 ? 1 : 0) + (lvl() >= 9 ? 1 : 0), used = [], p = P();
    for (var k = 0; k < n; k++) (function(k){
      var y = k ? 0 : cl(p.y + R(-8, 8), 32, 170);
      if (k){ var tr = 0; do { y = R(32, 170); tr++; } while (tr < 30 && used.some(function(u){ return Math.abs(u - y) < 52; })); }
      used.push(y);
      var g = new THREE.Object3D(), lineM = glowM(0xff4fd8, .2), coreM = glowM(0xffffff, 1), haloM = glowM(0xff4fd8, .35);
      var line = mesh(G.box, lineM, 1100, 1.2, 1, 0, 0, 0, g), core = mesh(G.box, coreM, 1100, 4, 2, 0, 0, 0, g), halo = mesh(G.box, haloM, 1100, 13, 1.5, 0, 0, 0, g);
      core.visible = halo.visible = false;
      var e = {kind:'laser', mesh:g, x:0, y:y, wait:k*420, ph:'wait', t:0, T:cl(900*hz(), 650, 1200), hit:false};
      e.mesh.visible = false;
      e.step = function(dt){
        if (this.wait > 0){ this.wait -= dt; return false; }
        if (this.ph === 'wait'){ this.ph = 'tele'; this.t = 0; this.mesh.visible = true; if (!k) alarm(); }
        this.t += dt; this.mesh.position.set(0, this.y, 0);
        if (this.ph === 'tele'){
          lineM.opacity = (Math.floor(this.t/90)%2) ? .55 : .15;
          if (this.t >= this.T){ this.ph = 'fire'; this.t = 0; line.visible = false; core.visible = halo.visible = true; ambientLight.intensity = 1.4; }
        } else {
          haloM.opacity = .25 + .15*Math.sin(this.t*.05);
          if (!this.hit && playing() && Math.abs(P().y - this.y) < 11){ this.hit = true; hurt(.8, P().x, this.y, 0xff4fd8); }
          if (this.t > 560) return true;
        }
        return false;
      };
      e.dispose = function(){ lineM.dispose(); coreM.dispose(); haloM.dispose(); };
      add(e);
    })(k);
  }

  // ---------- 7. fireballs lobbed from below ----------
  function fireball(delay, yAvoid){
    var T = (1550 - Math.min(lvl(), 8)*35)*cl(hz(), .85, 1.3), p = P(), grav = .00016, y0 = -10;
    var yc = R(55, 165); if (yAvoid !== undefined && Math.abs(yc - yAvoid) < 45) yc = cl(yAvoid + (yc > yAvoid ? 50 : -50), 50, 168);
    var vx = -R(.1, .13)*Math.max(.55, XS), x0 = p.x - vx*T, vy = (yc - y0 + .5*grav*T*T)/T;
    var g = new THREE.Object3D();
    sp(8, 8, 8, glowM(0xff7a1a), 0, 0, 0, g); sp(5, 5, 5, glowM(0xffe14a), 0, 0, 0, g); sp(12, 12, 12, glowM(0xff5a1a, .25), 0, 0, 0, g);
    var e = {kind:'fireball', mesh:g, x:x0, y:y0, vy:vy, wait:delay || 0, minD:999, passed:false};
    e.mesh.visible = false;
    e.step = function(dt){
      if (this.wait > 0){ this.wait -= dt; return false; }
      if (!this.mesh.visible){ this.mesh.visible = true; alarm(); }
      this.vy -= grav*dt; this.x += vx*dt; this.y += this.vy*dt; this.mesh.position.set(this.x, this.y, 0);
      if (Math.random() < .8) emitPuff(this.x + 4, this.y, Math.random() < .3 ? 1 : 2);
      if (playing()){
        var q = P(), d = Math.sqrt((q.x - this.x)*(q.x - this.x) + (q.y - this.y)*(q.y - this.y));
        if (d < this.minD) this.minD = d;
        if (d < 13){ hurt(1, this.x, this.y, 0xff7a1a); return true; }
        if (!this.passed && this.x < q.x - 6){ this.passed = true; if (this.minD < 24) VF.onNearMiss(); }
      }
      return this.y < -30 || this.x < -330;
    };
    return add(e);
  }

  // ---------- 8. falling icicles (they shake, then drop) ----------
  function icicle(offsetX, yAvoid){
    var g = new THREE.Object3D(), ice = mat(0xbfe8ff, {emissive:0x1a4a70, shininess:90}), grav = .0005;
    var yc = R(40, 150); if (yAvoid !== undefined && Math.abs(yc - yAvoid) < 40) yc = cl(yAvoid + (yc > yAvoid ? 45 : -45), 38, 155);
    mesh(G.coneD, ice, 6.5, 28, 6.5, 0, 0, 0, g); mesh(G.coneD, ice, 3.6, 16, 3.6, 8, 5, 0, g); mesh(G.coneD, ice, 3, 12, 3, -7, 7, 0, g);
    var Tf = Math.sqrt(2*(208 - yc)/grav);
    var e = {kind:'icicle', mesh:g, x:SPAWN_X + 20 + (offsetX || 0), y:208, vy:0, fall:false, minD:999, passed:false, yc:yc};
    e.step = function(dt){
      this.x -= dxFrame; var sp_ = dt > 0 ? dxFrame/dt : 0, tc = sp_ > .01 ? (this.x - P().x)/sp_ : 99999;
      if (!this.fall && tc <= Tf) this.fall = true;
      var sh = (!this.fall && tc <= Tf + 520) ? R(-1.4, 1.4) : 0;
      if (this.fall){ this.vy -= grav*dt; this.y += this.vy*dt; }
      this.mesh.position.set(this.x + sh, this.y, 0);
      if (playing()){
        var q = P(), d = Math.sqrt((q.x - this.x)*(q.x - this.x) + (q.y - (this.y - 6))*(q.y - (this.y - 6)));
        if (d < this.minD) this.minD = d;
        if (d < 12){ hurt(1, this.x, this.y, 0xbfe8ff); return true; }
        if (!this.passed && this.x < q.x - 6){ this.passed = true; if (this.minD < 22) VF.onNearMiss(); }
      }
      if (this.y < 8){ particlesHolder.spawnParticles(new THREE.Vector3(this.x, 8, 0), 8, 0xbfe8ff, 2.2); return true; }
      return this.x < DESPAWN_X;
    };
    return add(e);
  }

  // ---------- 9. wind gusts: they push the plane up or down (no damage) ----------
  function gust(){
    var dir = Math.random() < .5 ? 1 : -1, g = new THREE.Object3D(), lines = [];
    for (var i = 0; i < 12; i++){
      var l = mesh(G.box, glowM(0xffffff, .55), R(36, 70), .7, .7, 0, 0, 0, g); l.userData = {x:R(-220, 300), y:R(20, 185), s:R(.8, 1.3)}; l.rotation.z = dir*.16; lines.push(l);
    }
    var e = {kind:'gust', mesh:g, x:0, y:0, t:0, dir:dir, strength:34 + Math.min(lvl(), 8)*2, tele:700, dur:1900};
    if (window.VF && VF.toast) VF.toast(dir > 0 ? 'UPDRAFT!' : 'DOWNDRAFT!', '#bfe8ff');
    e.step = function(dt){
      this.t += dt;
      var env = this.t < this.tele ? 0 : Math.sin(cl((this.t - this.tele)/this.dur, 0, 1)*Math.PI);
      game.windY = this.dir*this.strength*env;
      lines.forEach(function(l){ var u = l.userData; u.x -= .9*u.s*dt; if (u.x < -260) u.x = 300; l.position.set(u.x, u.y, -4); l.material.opacity = .15 + .45*Math.min(1, env + .3); });
      if (this.t > this.tele + this.dur){ game.windY = 0; return true; }
      return false;
    };
    e.dispose = function(){ game.windY = 0; lines.forEach(function(l){ l.material.dispose(); }); };
    return add(e);
  }

  // ---------- director ----------
  var SPAWN = {
    fighter:function(){ fighter(false); },
    ufo:function(){ fighter(true); },
    bomber:function(){ bomber(); },
    bird:function(){ birds(); },
    lightning:function(){ lightning(); },
    laser:function(){ laser(); },
    fireball:function(){ fireball(0); if (lvl() >= 3) fireball(480); if (lvl() >= 8) fireball(960); },
    icicle:function(){ icicle(0); if (lvl() >= 4) icicle(110*XS); },
    gust:function(){ gust(); }
  };
  SPAWN.meteor = function(){ meteor(0); if (lvl() >= 3) meteor(520); if (lvl() >= 7) meteor(1040); };
  function bigActive(){ for (var i = 0; i < list.length; i++) if (BIG[list[i].kind]) return true; return false; }
  function interval(){ return (Math.max(200, 330 - Math.min(lvl(), 12)*11) + R(0, 70))*hz(); }

  function update(dt){
    if (!root) return;
    if (playing() && window.VF && VF.hazards && game.distance >= nextAt){
      var types = VF.hazards() || [];
      if (types.length){
        var pick = types[Math.floor(Math.random()*types.length)];
        if (types.length > 1 && pick === lastKind) pick = types[(types.indexOf(pick) + 1)%types.length];
        if (BIG[pick] && bigActive()) nextAt = game.distance + 40;          // wait for the current big threat to finish
        else { lastKind = pick; if (pick !== 'gust') tell(pick); if (SPAWN[pick]) SPAWN[pick](); nextAt = game.distance + interval(); }
      } else nextAt = game.distance + 400;
    }
    for (var i = list.length - 1; i >= 0; i--){
      var e = list[i];
      if (e.done){ list.splice(i, 1); continue; }
      if (e.step(dt)){ kill(e); list.splice(i, 1); }
    }
  }
  return {init:init, reset:reset, update:update, force:function(k){ if (SPAWN[k]) SPAWN[k](); }, active:function(){ return list.length; }};
})();
