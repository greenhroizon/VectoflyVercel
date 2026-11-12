// VectoFly ads (Google AdSense). Rules this file follows on purpose, so players stay happy and Google stays happy:
//  - never while flying: the game screen has no ads, no overlays, no pop-ups, nothing near the controls
//  - ads only on information pages and on the menu / game-over screen, each in a labelled box away from buttons
//  - an ad is requested only when its box is about to scroll into view (better viewability, fewer wasted requests)
//  - the menu ad is renewed at most once every 3 finished runs and never faster than every 2 minutes (no auto-refresh)
//  - if you chose "Opt out" in the cookie notice, Google is asked for non-personalised ads
//
// SETUP (about 5 minutes, in your AdSense account): Ads > By ad unit > Display ads > "Responsive" (create 4 units), then paste
// the numeric ad unit ids below. A blank id means that spot stays empty (no gap). Also in AdSense:
//  - Auto ads: if you use them, switch OFF "Anchor" and "Vignette" overlay formats and add https://vectofly.com/ to "Excluded pages"
//  - Privacy & messaging: create and publish the consent message (needed for visitors in the EU, UK and Switzerland)
(function(){
  'use strict';
  var ENABLED = true;
  var CLIENT = 'ca-pub-7644045441600017';
  var SLOTS = { top: '', mid: '', bottom: '', menu: '' };     // e.g. { top: '1234567890', mid: '2345678901', bottom: '3456789012', menu: '4567890123' }
  var MENU_EVERY_N_RUNS = 3, MENU_MIN_GAP_MS = 120000;
  if (!ENABLED) return;

  var isGame = !!document.getElementById('panel'), loaded = false;
  function loadScript(){
    if (loaded) return; loaded = true;
    try { if (localStorage.getItem('vf_ga_off') === '1') (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1; } catch (e) {}
    var s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    document.head.appendChild(s);
  }
  function render(box, slot){
    box.innerHTML = '';
    var l = document.createElement('span'); l.className = 'ad-label'; l.textContent = 'Advertisement';
    var ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CLIENT); ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto'); ins.setAttribute('data-full-width-responsive', 'true');
    box.appendChild(l); box.appendChild(ins); box.classList.add('on');
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    // no ad for this visitor right now: give the space back instead of leaving a hole
    if (window.MutationObserver){
      new MutationObserver(function(m, o){
        if (ins.getAttribute('data-ad-status') === 'unfilled'){ box.classList.remove('on'); box.innerHTML = ''; o.disconnect(); }
      }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    }
  }
  function whenVisible(box, fn){
    if (!('IntersectionObserver' in window)){ fn(); return; }
    var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting){ io.disconnect(); fn(); } }, { rootMargin: '250px 0px' });
    io.observe(box);
  }

  if (!isGame){
    // information pages: Auto ads (if you turned them on) and/or the labelled boxes below
    loadScript();
    var boxes = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < boxes.length; i++){
      (function(box){ var slot = SLOTS[box.getAttribute('data-ad-slot')]; if (slot) whenVisible(box, function(){ render(box, slot); }); })(boxes[i]);
    }
    return;
  }

  // the game page: only the menu / game-over screen, never during a flight
  var box = null, last = 0, overs = 0, pending = false, shown = false;
  window.VFAds = {
    show: function(mode){
      if (!SLOTS.menu) return;
      box = box || document.getElementById('adMenu'); if (!box) return;
      box.hidden = false; loadScript();
      if (mode === 'over') overs++;
      var due = !shown || (mode === 'over' && overs >= MENU_EVERY_N_RUNS && Date.now() - last >= MENU_MIN_GAP_MS);
      if (!due || pending) return;
      pending = true;
      whenVisible(box, function(){ pending = false; if (box.hidden) return; overs = 0; last = Date.now(); shown = true; render(box, SLOTS.menu); });
    },
    hide: function(){ if (box) box.hidden = true; }
  };
})();
