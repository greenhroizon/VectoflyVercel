// VectoFly ads (Monetag, all-in-one "Multitag"). Rules this file follows on purpose, so players stay happy and revenue stays steady:
//  - the Monetag tag is loaded AFTER the page is ready (never blocks the game from starting)
//  - anything Monetag adds on top of the page (in-page push, interstitial, vignette) is hidden while the player is flying
//  - on the game page the tag loads only after GAME_AFTER_RUNS finished runs, so a new visitor first enjoys the game
//  - optional labelled boxes (a Monetag banner/zone script) sit away from buttons and load only when scrolled into view
//  - no rewards for clicking ads (incentivised clicks are forbidden)
//
// SETUP: Monetag dashboard > Sites > add vectofly.com > verify (the meta tag is already in every page) > "Multitag" (all-in-one).
// Paste the tag's script URL below (or send me the snippet and I will wire it). Blank = nothing loads.
// FREQUENCY: set it in Monetag (Multitag settings): one pop (OnClick) per 30+ minutes, and switch OFF the formats you do not want.
(function(){
  'use strict';
  var ENABLED = true;

  var CONFIG = {
    // The all-in-one tag. Examples of what Monetag gives you; use whichever form you got:
    //   src: 'https://YOUR-DOMAIN.com/tag.min.js',  attrs: { 'data-zone': '1234567' }
    //   src: 'https://YOUR-DOMAIN.com/401/1234567', attrs: {}
    multitag: { src: '', attrs: {} },

    // Optional zones inside labelled boxes (script URL of a Monetag banner / native zone). Leave blank if you only use Multitag.
    slots: { top: '', mid: '', bottom: '', menu: '', menu2: '' },

    // Optional Monetag Direct Link, used by the small labelled "Sponsored offers" link
    directLink: ''
  };

  var GAME_AFTER_RUNS = 1;      // game page: load the tag from the Nth finished run (0 = load on the first menu)
  var INFO_DELAY_MS = 3500;     // information pages: load the tag this long after the page opens (or on first scroll/tap)
  var MENU_EVERY_N_RUNS = 2, MENU_MIN_GAP_MS = 90000, OVER_DELAY_MS = 1200;   // optional menu boxes only

  if (!ENABLED) return;
  try { if (localStorage.getItem('vf_ads_off') === '1') return; } catch (e) {}

  var isGame = !!document.getElementById('panel');
  var flying = false, tagLoaded = false, tracked = [];

  // ---------- helpers ----------
  function addScript(src, attrs, where){
    if (!src) return null;
    var s = document.createElement('script');
    s.async = true; s.src = src; s.setAttribute('data-cfasync', 'false');
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) s.setAttribute(k, attrs[k]);
    (where || document.body).appendChild(s);
    return s;
  }
  function whenVisible(box, fn){
    if (!('IntersectionObserver' in window)){ fn(); return; }
    var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting){ io.disconnect(); fn(); } }, { rootMargin: '250px 0px' });
    io.observe(box);
  }

  // ---------- keep Monetag overlays out of the flight ----------
  var OURS = { vfNotice: 1, toast: 1, gameHolder: 1, panel: 1, shop: 1, soundBtn: 1, warn: 1, pauseBar: 1, boot: 1 };
  function watchBody(){
    if (!window.MutationObserver) return;
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        for (var i = 0; i < m.addedNodes.length; i++){
          var n = m.addedNodes[i];
          if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK' || n.tagName === 'NOSCRIPT') continue;
          if ((n.id && OURS[n.id]) || n.getAttribute('data-vf-keep') || n.className === 'seo-content') continue;
          if (tracked.indexOf(n) < 0){ tracked.push(n); if (flying) n.style.setProperty('display', 'none', 'important'); }
        }
      });
    }).observe(document.body, { childList: true });
  }
  function setFlying(f){
    flying = f;
    for (var i = 0; i < tracked.length; i++){
      if (f) tracked[i].style.setProperty('display', 'none', 'important'); else tracked[i].style.removeProperty('display');
    }
  }

  function loadTag(){
    if (tagLoaded || !CONFIG.multitag.src) return;
    tagLoaded = true; watchBody();
    addScript(CONFIG.multitag.src, CONFIG.multitag.attrs);
  }

  // ---------- optional zone boxes + sponsored link ----------
  function fillBox(box, src){
    if (!src) return false;
    box.innerHTML = '';
    var l = document.createElement('span'); l.className = 'ad-label'; l.textContent = 'Advertisement';
    var body = document.createElement('div'); body.className = 'ad-body';
    box.appendChild(l); box.appendChild(body); box.classList.add('on');
    addScript(src, null, body);
    setTimeout(function(){ if (!body.querySelector('iframe, img, a, ins, div')){ box.classList.remove('on'); box.innerHTML = ''; } }, 8000);
    return true;
  }
  function wireSponsored(){
    if (!CONFIG.directLink) return;
    var a = document.querySelectorAll('a[data-sponsored]');
    for (var i = 0; i < a.length; i++){
      a[i].href = CONFIG.directLink; a[i].target = '_blank'; a[i].rel = 'noopener sponsored nofollow'; a[i].hidden = false;
    }
  }

  // ---------- information pages ----------
  function startInfo(){
    wireSponsored();
    var boxes = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < boxes.length; i++){
      (function(box){
        var src = CONFIG.slots[box.getAttribute('data-ad-slot')];
        if (src) whenVisible(box, function(){ fillBox(box, src); });
      })(boxes[i]);
    }
    if (!CONFIG.multitag.src) return;
    var go = function(){ window.removeEventListener('scroll', go); window.removeEventListener('pointerdown', go); loadTag(); };
    window.addEventListener('scroll', go, { once: true, passive: true });
    window.addEventListener('pointerdown', go, { once: true, passive: true });
    setTimeout(go, INFO_DELAY_MS);
  }

  // ---------- the game page ----------
  function startGame(){
    wireSponsored();
    var box1 = null, box2 = null, last = 0, overs = 0, finished = 0, pending = false, shown = false;
    window.VFAds = {
      show: function(mode){
        box1 = box1 || document.getElementById('adMenu'); box2 = box2 || document.getElementById('adMenu2');
        setFlying(false);
        if (mode === 'over'){ overs++; finished++; }
        if (finished >= GAME_AFTER_RUNS) setTimeout(loadTag, mode === 'over' ? OVER_DELAY_MS : 800);
        if (!box1 || !(CONFIG.slots.menu || CONFIG.slots.menu2)) return;
        box1.hidden = false; if (box2) box2.hidden = false;
        var due = !shown || (mode === 'over' && overs >= MENU_EVERY_N_RUNS && Date.now() - last >= MENU_MIN_GAP_MS);
        if (!due || pending) return;
        pending = true;
        var go = function(){
          whenVisible(box1, function(){
            pending = false; if (box1.hidden) return;
            overs = 0; last = Date.now(); shown = true;
            fillBox(box1, CONFIG.slots.menu); if (box2) fillBox(box2, CONFIG.slots.menu2);
          });
        };
        if (mode === 'over') setTimeout(go, OVER_DELAY_MS); else go();
      },
      hide: function(){
        if (box1) box1.hidden = true; if (box2) box2.hidden = true;
        setFlying(true);
      }
    };
  }

  if (isGame) startGame(); else startInfo();
})();
