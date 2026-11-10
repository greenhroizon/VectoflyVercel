// VectoFly ads (Monetag, four separate zones). Built for visitors who arrive from paid ads: earn early, annoy late.
//
//  ZONE              WHEN IT LOADS                                                         WHY
//  OnClick pop-under menu, ~1.2 s after landing (fires on the first click, usually "Play")  best earner; opens BEHIND the game, which auto-pauses
//  In-Page Push      menu idle for 6 s, or after the first finished run; info pages 3.5 s   small corner card, hidden while flying
//  Push notification after the first finished run (info pages: after 12 s)                  asked when the player is already happy
//  Vignette banner   game over of run 3, 6, 9 ... (info pages: from the 2nd page view)      full-screen format, only on result screens
//
//  - nothing is ever loaded or shown while flying: overlays Monetag adds are hidden the moment a run starts
//  - every zone is loaded at most once per page, and each has a "not again for ..." cap saved in the browser
//  - "Opt out" in the cookie notice switches all ads off in that browser
//  - no rewards for clicking ads (incentivised clicks are forbidden)
// Frequency/interval inside each zone is set in the Monetag dashboard; set it generously (see README).
(function(){
  'use strict';
  var ENABLED = true;

  var ZONES = {
    popunder: { src: 'https://al5sm.com/tag.min.js',        zone: '12233446' },
    inpage:   { src: 'https://nap5k.com/tag.min.js',        zone: '12233431' },
    vignette: { src: 'https://n6wxm.com/vignette.min.js',   zone: '12233433' },
    push:     { src: 'https://5gvci.com/act/files/tag.min.js?z=12233420', zone: '' }
  };

  // not-again caps (saved in the browser, so they hold across visits)
  var GAP = { popunder: 20 * 60e3, inpage: 0, vignette: 10 * 60e3, push: 12 * 3600e3 };
  var T = {
    popMenuMs: 1200,          // game page: arm the pop-under this long after the menu appears
    inpageIdleMs: 6000,       // game page: show In-Page Push if the player has not started a run by then
    afterOverMs: 1200,        // wait this long after the score appears before loading anything
    pushAfterOverMs: 2600,    // the notification question comes a moment after the score
    infoPopMs: 1500, infoInpageMs: 3500, infoPushMs: 12000, infoVignetteMs: 25000
  };
  var VIGNETTE_EVERY_N_RUNS = 3, PUSH_AFTER_RUNS = 1, INPAGE_AFTER_RUNS = 1;

  // optional labelled boxes (a Monetag banner/native zone script) and a Direct Link; leave blank if unused
  var SLOTS = { top: '', mid: '', bottom: '', menu: '', menu2: '' };
  var DIRECT_LINK = '';

  if (!ENABLED) return;
  function lget(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  if (lget('vf_ads_off') === '1') return;

  var isGame = !!document.getElementById('panel');
  var flying = false, loaded = {}, tracked = [], watching = false;

  // ---------- loading one zone (same pattern Monetag gives you) ----------
  function allowed(name){
    if (loaded[name]) return false;
    var last = +lget('vf_ad_' + name) || 0;
    return !GAP[name] || Date.now() - last >= GAP[name];
  }
  function load(name){
    if (!allowed(name)) return false;
    if (name === 'push' && window.Notification && Notification.permission === 'denied') return false;
    var z = ZONES[name]; if (!z || !z.src) return false;
    loaded[name] = true; lset('vf_ad_' + name, String(Date.now()));
    watch();
    var s = document.createElement('script');
    if (z.zone) s.dataset.zone = z.zone;
    s.setAttribute('data-cfasync', 'false'); s.async = true; s.src = z.src;
    (document.body || document.documentElement).appendChild(s);
    return true;
  }

  // ---------- keep Monetag overlays out of the flight ----------
  var OURS = { vfNotice: 1, toast: 1, gameHolder: 1, panel: 1, shop: 1, soundBtn: 1, warn: 1, pauseBar: 1, boot: 1 };
  function consider(n){
    if (n.nodeType !== 1) return;
    var t = n.tagName;
    if (t === 'SCRIPT' || t === 'STYLE' || t === 'LINK' || t === 'NOSCRIPT' || t === 'HEAD' || t === 'BODY' || t === 'META') return;
    if ((n.id && OURS[n.id]) || (n.className === 'seo-content') || (n.getAttribute && n.getAttribute('data-vf-keep'))) return;
    if (tracked.indexOf(n) < 0){ tracked.push(n); if (flying) n.style.setProperty('display', 'none', 'important'); }
  }
  function watch(){
    if (watching || !window.MutationObserver) return; watching = true;
    var mo = new MutationObserver(function(ms){ ms.forEach(function(m){ for (var i = 0; i < m.addedNodes.length; i++) consider(m.addedNodes[i]); }); });
    mo.observe(document.body, { childList: true });
    mo.observe(document.documentElement, { childList: true });
  }
  function setFlying(f){
    flying = f;
    for (var i = 0; i < tracked.length; i++){
      if (f) tracked[i].style.setProperty('display', 'none', 'important'); else tracked[i].style.removeProperty('display');
    }
  }

  // ---------- optional boxes + sponsored link ----------
  function addScript(src, where){
    var s = document.createElement('script'); s.async = true; s.src = src; s.setAttribute('data-cfasync', 'false'); where.appendChild(s);
  }
  function whenVisible(box, fn){
    if (!('IntersectionObserver' in window)){ fn(); return; }
    var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting){ io.disconnect(); fn(); } }, { rootMargin: '250px 0px' });
    io.observe(box);
  }
  function fillBox(box, src){
    if (!src) return;
    box.innerHTML = '';
    var l = document.createElement('span'); l.className = 'ad-label'; l.textContent = 'Advertisement';
    var body = document.createElement('div'); body.className = 'ad-body';
    box.appendChild(l); box.appendChild(body); box.classList.add('on'); addScript(src, body);
    setTimeout(function(){ if (!body.querySelector('iframe, img, a, ins, div')){ box.classList.remove('on'); box.innerHTML = ''; } }, 8000);
  }
  function wireSponsored(){
    if (!DIRECT_LINK) return;
    var a = document.querySelectorAll('a[data-sponsored]');
    for (var i = 0; i < a.length; i++){ a[i].href = DIRECT_LINK; a[i].target = '_blank'; a[i].rel = 'noopener sponsored nofollow'; a[i].hidden = false; }
  }

  // ---------- information pages ----------
  function startInfo(){
    wireSponsored();
    var boxes = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < boxes.length; i++){
      (function(box){ var src = SLOTS[box.getAttribute('data-ad-slot')]; if (src) whenVisible(box, function(){ fillBox(box, src); }); })(boxes[i]);
    }
    var pv = 1;
    try { pv = (+sessionStorage.getItem('vf_pv') || 0) + 1; sessionStorage.setItem('vf_pv', String(pv)); } catch (e) {}
    setTimeout(function(){ load('popunder'); }, T.infoPopMs);
    // In-Page Push also appears early if the visitor scrolls or taps (they are engaged)
    var early = function(){ window.removeEventListener('scroll', early); window.removeEventListener('pointerdown', early); load('inpage'); };
    window.addEventListener('scroll', early, { once: true, passive: true });
    window.addEventListener('pointerdown', early, { once: true, passive: true });
    setTimeout(early, T.infoInpageMs);
    setTimeout(function(){ load('push'); }, T.infoPushMs);
    if (pv >= 2) setTimeout(function(){ load('vignette'); }, T.infoVignetteMs);
  }

  // ---------- the game page ----------
  function startGame(){
    wireSponsored();
    var box1 = null, box2 = null, finished = 0, flew = true, idleTimer = 0, menuSeen = false, boxShown = false, lastBox = 0, overs = 0;
    window.VFAds = {
      show: function(mode){
        box1 = box1 || document.getElementById('adMenu'); box2 = box2 || document.getElementById('adMenu2');
        setFlying(false);
        var fresh = flew; flew = false;                 // count a finished run once, not on every redraw of the screen

        if (!menuSeen){                                  // first time the menu is on screen
          menuSeen = true;
          setTimeout(function(){ if (!flying) load('popunder'); }, T.popMenuMs);
        }
        if (mode === 'over' && fresh){
          finished++; overs++;
          if (finished >= PUSH_AFTER_RUNS) setTimeout(function(){ if (!flying) load('push'); }, T.pushAfterOverMs);
          if (finished >= INPAGE_AFTER_RUNS) setTimeout(function(){ if (!flying) load('inpage'); }, T.afterOverMs);
          if (finished % VIGNETTE_EVERY_N_RUNS === 0) setTimeout(function(){ if (!flying) load('vignette'); }, T.afterOverMs + 400);
        }
        clearTimeout(idleTimer);
        if (mode !== 'over') idleTimer = setTimeout(function(){ if (!flying) load('inpage'); }, T.inpageIdleMs);

        // optional boxes (only if you filled SLOTS.menu / SLOTS.menu2)
        if (box1 && (SLOTS.menu || SLOTS.menu2)){
          box1.hidden = false; if (box2) box2.hidden = false;
          var due = !boxShown || (mode === 'over' && fresh && overs >= 2 && Date.now() - lastBox >= 90000);
          if (due){
            boxShown = true; lastBox = Date.now(); overs = 0;
            setTimeout(function(){ whenVisible(box1, function(){ if (box1.hidden) return; fillBox(box1, SLOTS.menu); if (box2) fillBox(box2, SLOTS.menu2); }); }, mode === 'over' ? T.afterOverMs : 0);
          }
        }
      },
      hide: function(){
        clearTimeout(idleTimer); flew = true;
        if (box1) box1.hidden = true; if (box2) box2.hidden = true;
        setFlying(true);
      }
    };
  }

  if (isGame) startGame(); else startInfo();
})();
