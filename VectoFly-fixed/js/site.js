// Shared by every VectoFly page: analytics notice + opt-out, and "report a bug / feedback" links that include device info.
(function(){
  var EMAIL = 'contact@vectofly.com', GA_ID = 'G-LXSLC7ZVNW';
  function get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  // ---- feedback / bug links: prefilled with the details we need to fix things ----
  function info(){
    var s = [], w = window;
    s.push('Page: ' + location.href);
    s.push('Browser: ' + navigator.userAgent);
    s.push('Screen: ' + screen.width + 'x' + screen.height + ' (window ' + w.innerWidth + 'x' + w.innerHeight + ', pixel ratio ' + (w.devicePixelRatio || 1) + ')');
    try { if (w.VF && VF.debugInfo) s.push(VF.debugInfo()); } catch(e){}
    return s.join('\n');
  }
  window.vfFeedbackHref = function(){
    var body = 'Hi VectoFly team,\n\nWhat happened / what I would like to see:\n\n\n\nSteps to repeat it (if a bug):\n1.\n2.\n\n----- device info (please keep) -----\n' + info();
    return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('VectoFly bug report / feedback') + '&body=' + encodeURIComponent(body);
  };
  function wireFeedback(root){
    var a = (root || document).querySelectorAll('a[data-feedback]');
    for (var i = 0; i < a.length; i++){ if (!a[i].__fb){ a[i].__fb = 1; a[i].addEventListener('click', function(e){ this.href = window.vfFeedbackHref(); }); a[i].addEventListener('touchstart', function(){ this.href = window.vfFeedbackHref(); }, {passive:true}); } }
  }
  window.vfWireFeedback = wireFeedback;

  // ---- analytics notice + opt-out (Google's documented ga-disable switch) ----
  function optOut(off){
    set('vf_ga_off', off ? '1' : '0'); window['ga-disable-' + GA_ID] = !!off;
    var s = document.querySelectorAll('[data-ga-status]');
    for (var i = 0; i < s.length; i++) s[i].textContent = off ? 'Analytics is OFF for this browser.' : 'Analytics is ON for this browser.';
  }
  // The notice is a clear card in the bottom corner. It reserves its own space (--vfn) so the menu, the visitor counter and page
  // content move up instead of being covered by it.
  function reserve(px){ document.documentElement.style.setProperty('--vfn', px + 'px'); }
  function banner(){
    if (get('vf_notice') || document.getElementById('vfNotice')) return;
    var d = document.createElement('div'); d.id = 'vfNotice'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-live', 'polite'); d.setAttribute('aria-label', 'Cookies and analytics');
    d.innerHTML = '<div class="vfn-t"><b>Cookies &amp; analytics</b><span>We use Google Analytics to count visits and improve VectoFly. You can opt out at any time. <a href="cookie-policy.html">Learn more</a></span></div><div class="vfn-b"><button type="button" data-a="ok">Accept</button><button type="button" data-a="off" class="ghost">Opt out</button></div>';
    var st = document.createElement('style');
    st.textContent = '#vfNotice{position:fixed;z-index:99999;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:min(430px,calc(100vw - 24px));box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:#fffaf0;color:#3a2a22;border:2px solid #d1b790;box-shadow:0 8px 30px rgba(35,25,15,.35);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:left}'
      + '#vfNotice .vfn-t{display:flex;flex-direction:column;gap:3px}#vfNotice b{font-size:15px;color:#59332e}#vfNotice span{opacity:.9}#vfNotice a{color:#b4372b;font-weight:600}'
      + '#vfNotice .vfn-b{display:flex;gap:8px}#vfNotice button{flex:1;min-height:42px;border-radius:10px;border:2px solid #f25346;background:#f25346;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer;touch-action:manipulation}'
      + '#vfNotice button.ghost{background:transparent;color:#59332e;border-color:#b9a27c}#vfNotice button:focus-visible{outline:3px solid #68c3c0;outline-offset:2px}'
      + '@media (max-width:520px){#vfNotice{left:10px;right:10px;width:auto;padding:12px 14px;font-size:13px}#vfNotice button{min-height:40px}}'
      + '@media (max-height:520px){#vfNotice{flex-direction:row;align-items:center;width:min(640px,calc(100vw - 24px));padding:8px 12px;gap:12px}#vfNotice .vfn-t{flex:1}#vfNotice .vfn-b{flex:0 0 auto}#vfNotice button{flex:0 0 auto;min-width:84px;min-height:36px}}';
    document.head.appendChild(st); document.body.appendChild(d);
    function measure(){ var el = document.getElementById('vfNotice'); reserve(el ? Math.ceil(el.getBoundingClientRect().height) + 16 : 0); }
    measure(); setTimeout(measure, 300); window.addEventListener('resize', measure);
    d.addEventListener('click', function(e){
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'off') optOut(true); set('vf_notice', '1'); d.parentNode && d.parentNode.removeChild(d); reserve(0); window.removeEventListener('resize', measure);
    });
  }
  function init(){
    wireFeedback();
    var on = get('vf_ga_off') !== '1', s = document.querySelectorAll('[data-ga-status]');
    for (var i = 0; i < s.length; i++) s[i].textContent = on ? 'Analytics is ON for this browser.' : 'Analytics is OFF for this browser.';
    var b = document.querySelectorAll('[data-ga-optout]'); for (i = 0; i < b.length; i++) b[i].addEventListener('click', function(){ optOut(true); });
    b = document.querySelectorAll('[data-ga-optin]'); for (i = 0; i < b.length; i++) b[i].addEventListener('click', function(){ optOut(false); });
    setTimeout(banner, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
