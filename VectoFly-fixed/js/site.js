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
  function banner(){
    if (get('vf_notice') || document.getElementById('vfNotice')) return;
    var d = document.createElement('div'); d.id = 'vfNotice'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Analytics notice');
    d.innerHTML = '<span>Analytics is used to improve the game. <a href="cookie-policy.html">Details</a></span><button type="button" data-a="ok">OK</button><button type="button" data-a="off" class="ghost">Opt out</button>';
    var st = document.createElement('style');
    st.textContent = '#vfNotice{position:fixed;z-index:99999;left:50%;transform:translateX(-50%);bottom:max(10px,env(safe-area-inset-bottom));width:min(560px,calc(100vw - 20px));display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:rgba(35,25,15,.94);color:#fff6e2;font:12px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}#vfNotice span{flex:1 1 auto;min-width:0}#vfNotice a{color:#f4ce93}#vfNotice button{border:0;border-radius:8px;padding:7px 11px;font:700 12px system-ui,sans-serif;white-space:nowrap;background:#f25346;color:#fff;cursor:pointer}#vfNotice button.ghost{background:transparent;border:1px solid rgba(255,246,226,.5);color:#fff6e2}';
    document.head.appendChild(st); document.body.appendChild(d);
    d.addEventListener('click', function(e){
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'off') optOut(true); set('vf_notice', '1'); d.parentNode && d.parentNode.removeChild(d);
    });
  }
  function init(){
    wireFeedback();
    var on = get('vf_ga_off') !== '1', s = document.querySelectorAll('[data-ga-status]');
    for (var i = 0; i < s.length; i++) s[i].textContent = on ? 'Analytics is ON for this browser.' : 'Analytics is OFF for this browser.';
    var b = document.querySelectorAll('[data-ga-optout]'); for (i = 0; i < b.length; i++) b[i].addEventListener('click', function(){ optOut(true); });
    b = document.querySelectorAll('[data-ga-optin]'); for (i = 0; i < b.length; i++) b[i].addEventListener('click', function(){ optOut(false); });
    setTimeout(banner, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
