// Google AdSense helper for the CONTENT pages (how-to-play, leaderboard, about, ...). It is OFF by default, so no ad code runs
// and no space is reserved until you switch it on. The game screen itself never shows ads from this file.
//
// After Google approves vectofly.com in AdSense:
//   1. set ENABLED to true
//   2. (optional) create ad units in AdSense and paste their slot ids into SLOTS - or just turn on "Auto ads" in AdSense
//   3. for visitors in the EU/UK/Switzerland, enable Google's consent message (AdSense > Privacy & messaging) - it is required there
(function(){
  var ENABLED = false;
  var CLIENT = 'ca-pub-7644045441600017';
  var SLOTS = { top: '', bottom: '' };          // e.g. { top: '1234567890', bottom: '0987654321' }
  if (!ENABLED) return;
  var s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
  document.head.appendChild(s);
  var boxes = document.querySelectorAll('.ad-slot');
  for (var i = 0; i < boxes.length; i++){
    var slot = SLOTS[boxes[i].getAttribute('data-ad-slot')]; if (!slot) continue;
    boxes[i].innerHTML = '<span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="' + CLIENT + '" data-ad-slot="' + slot + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    boxes[i].className += ' on';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){}
  }
})();
