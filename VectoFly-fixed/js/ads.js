// VectoFly ads: Adsterra BANNERS only. No pop-unders, no redirects, no overlays.
//
//  GAME PAGE   big screen: 160px ad rails left and right of the game (160x600, or 160x300 on shorter screens)
//              other screens: a small strip under the game AND one above it (468x60, or 320x50 on phones; the top one needs 500px+ of height)
//              they never cover the game: the game area is made smaller to make room, and they stay while flying
//              menu / game-over: a small banner right under the Play button + a 300x250 box lower in the menu (hidden when a run starts)
//              everything renews only on the game-over screen of every 2nd finished run (never on a timer)
//  INFO PAGES  top 728x90 (mobile 320x50), middle 300x250, bottom 468x60 (mobile 300x250)
//              wide screens (1200px+): 160x600 and 160x300 side rails beside the text
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
  var T = { overDelayMs: 1200 };
  var MENU_EVERY_N_RUNS = 2, MENU_MIN_GAP_MS = 90000;
  var RAILS_MIN_WIDTH = 1200;

  if (!ENABLED) return;
  function lget(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
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
  }

  // ---------- the game page ----------
  // The game area is shrunk (CSS variables on #gameHolder) to leave room, so ads never sit on top of the game:
  //   big screen  (1100px+ wide, 420px+ tall): a 160px rail on each side, 160x600 if the screen is 700px+ tall, else 160x300
  //   other screens: a small strip under the game, plus one above it on 500px+ tall screens: 468x60 (560px+ wide) or 320x50
  function gameMode(){
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (w >= 1100 && h >= 420) return h >= 700 ? { m: 'rails', k: 'r600', w: 160, h: 600, key: B.b160x600 } : { m: 'rails', k: 'r300', w: 160, h: 300, key: B.b160x300 };
    if (w >= 340 && h >= 340){
      var big = w >= 560;
      return { m: 'bar', k: (big ? 'b468' : 'b320') + (h >= 500 ? 't' : ''), w: big ? 468 : 320, h: big ? 60 : 50, key: big ? B.b468x60 : B.b320x50, top: h >= 500 };
    }
    return { m: 'none', k: 'none' };
  }
  var gl = { cur: '', L: null, R: null, bar: null, top: null, styled: false, sz: { l: 0, r: 0, b: 0, t: 0 } };
  function px(n){ return n ? n + 'px' : '0px'; }
  function applyVars(){
    var st = document.documentElement.style, z = gl.sz, sb = 'env(safe-area-inset-bottom,0px)', stp = 'env(safe-area-inset-top,0px)';
    st.setProperty('--vf-l', px(z.l)); st.setProperty('--vf-r', px(z.r));
    st.setProperty('--vf-b', z.b ? 'calc(' + z.b + 'px + ' + sb + ')' : '0px');
    st.setProperty('--vf-t', z.t ? 'calc(' + z.t + 'px + ' + stp + ')' : '0px');
  }
  function glStyle(){
    if (gl.styled) return; gl.styled = true;
    var st = document.createElement('style');
    st.textContent =
      '.vf-gr{position:fixed;top:50%;transform:translateY(-50%);z-index:3;width:160px;text-align:center}.vf-gr.l{left:8px}.vf-gr.r{right:8px}' +
      '.vf-gr .ad-label{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#59332e;opacity:.6;margin-bottom:4px}' +
      '.vf-gr .ad-body{display:flex;justify-content:center;overflow:hidden}' +
      '.vf-gb,.vf-gt{position:fixed;left:0;right:0;z-index:3;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(35,25,15,.92)}' +
      '.vf-gb{bottom:0;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px))}' +
      '.vf-gt{top:0;padding:calc(4px + env(safe-area-inset-top,0px)) 0 4px}' +
      '.vf-gb .ad-label,.vf-gt .ad-label{display:block;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#f4ce93;opacity:.7;margin-bottom:3px;line-height:1}' +
      '.vf-gb .ad-body,.vf-gt .ad-body{display:flex;justify-content:center;overflow:hidden;max-width:100%}';
    document.head.appendChild(st);
  }
  function mk(cls){
    var d = document.createElement('div'); d.className = cls; d.setAttribute('aria-label', 'Advertisement'); d.setAttribute('data-vf-keep', '1');
    document.body.appendChild(d); return d;
  }
  function glClear(){
    ['L', 'R', 'bar', 'top'].forEach(function(k){ if (gl[k]){ gl[k].remove(); gl[k] = null; } });
    gl.sz = { l: 0, r: 0, b: 0, t: 0 }; applyVars();
  }
  function glApply(force){
    var g = gameMode();
    if (g.k === gl.cur && !force) return;
    var changed = g.k !== gl.cur; gl.cur = g.k;
    glStyle();
    if (changed) glClear();
    var sp = g.m === 'none' ? null : spec(g.key, g.w, g.h);
    if (g.m === 'rails'){
      var side = g.w + 16;
      if (!gl.L) gl.L = mk('vf-gr l'); if (!gl.R) gl.R = mk('vf-gr r');
      gl.sz.l = side; gl.sz.r = side; applyVars();
      render(gl.L, sp, function(){ gl.sz.l = 0; applyVars(); });
      render(gl.R, sp, function(){ gl.sz.r = 0; applyVars(); });
    } else if (g.m === 'bar'){
      var hh = g.h + 20;
      if (!gl.bar) gl.bar = mk('vf-gb');
      gl.bar.style.height = 'calc(' + hh + 'px + env(safe-area-inset-bottom,0px))';
      gl.sz.b = hh;
      if (g.top){
        if (!gl.top) gl.top = mk('vf-gt');
        gl.top.style.height = 'calc(' + hh + 'px + env(safe-area-inset-top,0px))';
        gl.sz.t = hh;
      } else if (gl.top){ gl.top.remove(); gl.top = null; gl.sz.t = 0; }
      applyVars();
      render(gl.bar, sp, function(){ gl.sz.b = 0; applyVars(); });
      if (gl.top) render(gl.top, sp, function(){ gl.sz.t = 0; applyVars(); });
    }
  }

  function startGame(){
    var box1 = null, boxP = null, overs = 0, flew = true, shown = false, last = 0, pending = false, rz = 0;
    // game ads (rails / strips) appear shortly after the game is up, and follow the window size
    setTimeout(function(){ glApply(false); }, 1800);
    window.addEventListener('resize', function(){ clearTimeout(rz); rz = setTimeout(function(){ if (gl.cur) glApply(false); }, 400); });
    function playSpec(){
      var w = boxP ? boxP.clientWidth : 0;
      if (w >= 468) return spec(B.b468x60, 468, 60);
      if (!w || w >= 320) return spec(B.b320x50, 320, 50);
      return null;
    }
    window.VFAds = {
      show: function(mode){
        box1 = box1 || document.getElementById('adMenu'); boxP = boxP || document.getElementById('adPlay');
        var fresh = flew; flew = false;                 // count a finished run once, not on every redraw of the screen
        var renew = false;
        if (mode === 'over' && fresh){
          overs++;
          if (overs >= MENU_EVERY_N_RUNS && Date.now() - last >= MENU_MIN_GAP_MS) renew = true;
        }
        if (renew) setTimeout(function(){ if (gl.cur && gl.cur !== 'none') glApply(true); }, T.overDelayMs + 300);
        if (boxP) boxP.hidden = false;
        if (box1) box1.hidden = false;
        var due = !shown || renew;
        if (!due || pending) return;
        pending = true;
        var go = function(){
          pending = false; if (box1 && box1.hidden) return;
          shown = true; last = Date.now(); overs = 0;
          if (boxP) whenVisible(boxP, function(){ if (!boxP.hidden) render(boxP, playSpec()); });
          if (box1) whenVisible(box1, function(){ if (!box1.hidden) render(box1, spec(B.b300x250, 300, 250)); });
        };
        if (mode === 'over') setTimeout(go, T.overDelayMs); else go();
      },
      hide: function(){
        flew = true;
        if (box1) box1.hidden = true; if (boxP) boxP.hidden = true;   // menu boxes go away; rails / strips stay, outside the game area
      }
    };
  }

  if (isGame) startGame(); else startInfo();
})();
