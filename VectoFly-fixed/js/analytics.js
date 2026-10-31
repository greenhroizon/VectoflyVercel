(function () {
  var enabled = false,
    key = "vectofly_analytics_consent";
  window.vfTrack = function (name, params) {
    if (enabled && window.gtag) gtag("event", name, params || {});
  };
  function start() {
    if (enabled) return;
    enabled = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      dataLayer.push(arguments);
    };
    gtag("js", new Date());
    gtag("config", "G-LXSLC7ZVNW", {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-LXSLC7ZVNW";
    document.head.appendChild(s);
  }
  function choice() {
    var old = document.getElementById("analytics-choice");
    if (old) old.remove();
    var box = document.createElement("aside");
    box.id = "analytics-choice";
    box.setAttribute("aria-label", "Analytics preference");
    box.style.cssText =
      "position:fixed;bottom:12px;left:12px;right:12px;max-width:510px;z-index:100;background:#fff9ec;color:#352b27;padding:16px;border:1px solid #b99d7b;border-radius:12px;font:14px system-ui;box-shadow:0 4px 24px #0003";
    box.innerHTML =
      '<p style="margin:0 0 12px">Allow optional Google Analytics to help improve VectoFly? Game saves work either way. <a href="privacy.html">Privacy</a></p><button type="button">Allow analytics</button> <button type="button">No thanks</button>';
    var bs = box.querySelectorAll("button");
    Array.prototype.forEach.call(bs, function (b, i) {
      b.style.cssText =
        "padding:12px;border:0;border-radius:6px;cursor:pointer";
      b.onclick = function () {
        try {
          localStorage.setItem(key, i === 0 ? "yes" : "no");
        } catch (e) {}
        box.remove();
        if (i === 0) start();
        else if (enabled) location.reload();
      };
    });
    document.body.appendChild(box);
  }
  window.vfAnalyticsChoice = choice;
  document.addEventListener("DOMContentLoaded", function () {
    var v;
    try {
      v = localStorage.getItem(key);
    } catch (e) {}
    if (v === "yes") start();
    else if (!v) choice();
    var a = document.createElement("button");
    a.textContent = "Analytics preferences";
    a.style.cssText =
      "position:fixed;bottom:0;right:0;z-index:30;font:10px system-ui;border:0;padding:4px;cursor:pointer";
    a.onclick = choice;
    document.body.appendChild(a);
  });
})();
