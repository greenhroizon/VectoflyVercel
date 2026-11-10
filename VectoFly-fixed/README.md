# VectoFly

Endless 3D plane game. Open `index.html` through any web server, or run the bundled one (below).

## Global leaderboard

The game shows a **World** tab (global) and a **This device** tab. The World tab turns on by itself when a
score server is reachable. Pick one option:

### Option A - bundled Node server (needs Node 16+, no npm install)
```
node server/server.js          # http://localhost:3000  (PORT=8080 node server/server.js to change)
```
It serves the game **and** `/api/scores`, so nothing to configure. Scores are stored in `server/data/scores.json`.
Deploy it on any Node host (Render, Railway, Fly.io, a VPS...). If the game files live somewhere else
(itch.io, GitHub Pages...), set `API_URL: 'https://your-server'` in `js/config.js`.
The server keeps one best score per player, rate-limits submissions and rejects impossible scores.

### Option B - Firebase Realtime Database (no server to run)
1. Create a project at https://console.firebase.google.com, add a **Realtime Database**.
2. Paste the database URL into `FIREBASE_URL` in `js/config.js`.
3. In the database **Rules** tab paste:
```json
{
  "rules": {
    "scores": {
      ".read": true,
      ".indexOn": ["s"],
      "$uid": {
        ".write": "!data.exists() || newData.child('s').val() >= data.child('s').val()",
        ".validate": "newData.hasChildren(['n','s','t'])",
        "n": { ".validate": "newData.isString() && newData.val().length <= 16" },
        "s": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
        "t": { ".validate": "newData.isNumber()" },
        "$other": { ".validate": false }
      }
    }
  }
}
```
Note: any browser game can be cheated by someone editing scores in their own browser; these limits only stop
the obvious abuse.

If neither is set up (or the server cannot be reached) the game falls back to the local board.

## Pilot names and boards (Nov 2026 update)
- Players cannot type a name. The game generates a random pilot name ("Swift Falcon 42") and the menu has a **New name** button. `js/vectofly.js`, `api/scores.js` and `server/server.js` share the same word lists (keep them identical). The servers accept only that exact format; anything else, including old typed names already in the database, is shown as a name derived from the player id. Name limit is 16 characters.
- There is no scoreboard while flying. The world leaderboard (top 50) is in the menu and the full list is on `leaderboard.html`. The menu also shows stat tiles (best, world rank, flights, top level) and a results card after each run.
- Icons: `favicon.ico`, `img/favicon-32.png`, `img/icon-192.png`, `img/icon-512.png`, `img/icon-maskable-512.png`, `img/apple-touch-icon.png` (links use `?v=2` to bypass the 1 year cache; bump it when you change them).
- If you change the privacy or terms text, update the "Last updated" dates and `sitemap.xml` lastmod.

## Ads (Monetag)
`js/ads.js` loads four Monetag zones, each at the right moment and never while flying: OnClick pop-under (menu, fires on first click, opens behind the game, capped 20 min), In-Page Push (menu idle 6 s / after first run), Push notification (after first run; needs `sw.js` in the site root, downloaded from Monetag), Vignette (game-over of runs 3, 6, 9..., capped 10 min). Overlays added by Monetag are hidden during a run.
- Set intervals in the Monetag dashboard too (In-Page Push: first show 10+ s, interval 3+ min; Vignette: interval 10+ min).
- `<meta name="monetag" ...>` is in every page for verification.
- Do not reward clicks or put ads next to buttons.

## Updates page
`updates.html` is the public changelog (newest first, one `<section class="rel">` per version with a date). When you ship a change, add a new section at the top, update the `jump` links, set `lastmod` for `updates.html` in `sitemap.xml`, and change the "Last updated" date on any legal page whose text you changed.

## QA checklist (run before every deploy)
Tested in Nov 2026 on desktop, Pixel 7, iPhone SE and a 280 px phone (headless Chrome, slowed CPU):
- All 11 pages load with no errors, no broken links or assets, valid structured data, no sideways scrolling.
- All 32 planes and all 50 maps start and run; every map's hazards spawn without errors; 66 paints load on the new planes.
- Menu, options, Low graphics, Hangar buying, difficulty, pause (P / tap / click), keyboard and touch steering, rotation, game over, repeated runs.
- Leaderboard API (`api/scores.js`) against a fake Firebase: visits, tickets, replay, tampering, name replacement, limits, rate limiting, database outage.
- Damaged saves, blocked/full storage and an offline or failing API do not stop the game.
- 14 runs in a row: no memory growth.
Not covered by these tests: real devices, real Firebase and Vercel, ad behaviour and sound on real speakers.

## Performance on slow phones (Nov 2026)
- The game now starts when our own scripts are ready, not when every third-party script (Analytics) has finished. A loading screen (`#boot`) shows until the first frame.
- Graphics quality adapts by itself (`Q` in `js/game.js`): level 0 shadows, 1 no shadows, 2 lower resolution, 3 lowest. It steps down when the average frame takes over ~31 ms and remembers the level (`vf_q` in localStorage). Phones with 2 GB of memory or few cores start at level 1. The menu has a "Low graphics" checkbox that forces level 2.
- Phone pixel ratio is capped at 1.25 and shadows use the cheaper filter; the hangar preview renderer no longer uses anti-aliasing on phones.

## Planes, maps and hazards (Nov 2026 update)
- 32 planes (models in `js/planes.js`, perks in `PLANES` in `js/vectofly.js`) and 50 maps. To add a plane, add a `K.yourkind` builder in `js/planes.js` and a `PLANES` entry.
- Every map has `haz:[...]`, its own threats from `js/hazards.js`: `fighter`, `ufo`, `bomber`, `meteor`, `bird`, `lightning`, `laser`, `fireball`, `icicle`, `gust`. Old maps are assigned in `HAZ_OF`, with a fallback by ground type. To change a map's threats edit its `haz`.
- Each hazard shows a warning first (flashing muzzle, red path, ring, flashing line) and does damage like a spike times a factor (bullets .55, bombs 1, birds .5, and so on), so armor perks still work. Difficulty changes how often they come (`hz` in `DIFFS`).
- Test one quickly in the browser console while flying: `Hazards.force('fighter')`.

## What is in the box
- `js/game.js` core loop: flat endless world, obstacles, **damage** meter, fuel
- `js/world.js` flat scrolling ground + scenery for every map
- `js/planes.js` plane models and paint patterns
- `js/vectofly.js` hangar (planes / paints / maps), leaderboard, audio, saves

## Difficulty
Easy / Medium / Hard / Hell is chosen on the menu (saved per device). Harder modes hit harder, spawn bigger and closer waves, speed up faster and burn fuel quicker, but multiply score and coins (x1 / x1.25 / x1.5 / x2). Tune them in the `DIFFS` table in `js/vectofly.js`.

## SEO setup (do this before launch)
1. Set your domain everywhere (index.html, how-to-play.html, privacy.html, robots.txt, sitemap.xml):
   `sh set-domain.sh https://yourdomain.com`   (no trailing slash)
2. Upload the whole folder. Apache hosts use `.htaccess`, Netlify/Cloudflare Pages use `_headers`, Node hosts use `server/server.js`.
3. Google Search Console: add the site, submit `https://yourdomain.com/sitemap.xml`, then "Request indexing" for the home page.
4. Bing Webmaster Tools: import from Search Console, or submit the sitemap.
5. Test: Rich Results Test (JSON-LD), PageSpeed Insights, and share a link on WhatsApp/Discord to check the preview image.
6. Replace `img/og-image.jpg` (1200x630) with a real gameplay screenshot when you have one.
7. Legal pages (privacy, terms, contact, cookies, disclaimer, DMCA, about) are included and use contact@vectofly.com.
Note: `sitemap.xml` lastmod dates should be updated whenever you change a page.

## Deploy on Vercel with the global leaderboard (no Firebase)
1. Push this folder to GitHub and import it in Vercel (Framework preset: Other, no build command).
2. In the Vercel project open **Storage** (or Marketplace) > add **Upstash Redis** > connect it to the project. Vercel adds
   the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) env vars for you.
3. Redeploy. Leave `API_URL` and `FIREBASE_URL` empty in `js/config.js`: the game calls `/api/scores` on the same domain.
4. Check `https://yourdomain.com/api/scores` shows `{"scores":[]}`. The World tab appears in the game.
`api/scores.js` is the Vercel version of `server/server.js` (same validation and rate limit). `.vercelignore` keeps `server/` off the live site.


## Leaderboard with Firebase (Vercel)
The game talks only to `/api/scores` (a Vercel function). That function stores everything in a **Firebase Realtime Database** using admin credentials, so the database itself can stay locked and nobody can write fake scores.

1. **Create the project** - https://console.firebase.google.com > Add project > any name (Analytics not needed).
2. **Create the database** - Build > Realtime Database > Create Database > pick a location > **Start in locked mode**. Copy the database URL at the top (like `https://my-game-default-rtdb.firebaseio.com`, or `...europe-west1.firebasedatabase.app`).
3. **Paste the rules** - Realtime Database > Rules tab > replace everything with the text below > Publish:
```
{
  "rules": {
    ".read": false,
    ".write": false,
    "scores": { ".indexOn": ["s"] },
    "used":   { ".indexOn": ".value" }
  }
}
```
4. **Get the admin key** - Project settings (gear icon) > Service accounts > Generate new private key > Generate key. A `.json` file downloads. Keep it private, never put it in the website files or GitHub.
5. **Add 2 variables in Vercel** - your project > Settings > Environment Variables (enable Production, Preview and Development):
   - `FIREBASE_DB_URL` = the database URL from step 2
   - `FIREBASE_SERVICE_ACCOUNT` = open the downloaded `.json` in a text editor, copy **everything** (from the first `{` to the last `}`), paste it as the value
6. **Redeploy** - Deployments > latest > ... > Redeploy (variables only apply to new deployments).
7. **Check** - open `https://your-site.vercel.app/api/scores?debug=1`. You want `"ok":true`, `"read":"ok"`, `"write":"ok"`.

If the check fails, `debug` says what is wrong (missing variable, invalid JSON, wrong URL, permission). Old Redis / Upstash variables are no longer used and can be removed.
Easier alternative to step 4: Project settings > Service accounts > Database secrets > Show, copy the secret and set it as `FIREBASE_SECRET` instead of `FIREBASE_SERVICE_ACCOUNT` (older method, still works).

## Anti-cheat
- **Signed run tickets**: when a flight starts the server issues a signed, single-use ticket bound to the player. A score is only accepted with a valid, unused ticket.
- **Physics check on the server**: distance must fit the real time elapsed (and the time actually played), pills must fit the distance, the score must equal `(distance + 5 x pills) x difficulty multiplier`, and the level must match the distance.
- **In-game guards**: damage, fuel, distance and speed are tracked separately; editing them in the console stops the run ("Cheat detected") and the run is not submitted or rewarded.
- Optional: set `SCORE_SECRET` (any long random string) in Vercel env vars to sign tickets with your own secret.
No browser game can be 100% cheat-proof (the code runs on the player's device), but a faked score now has to look like a real run that took real time.

## Controls
- **Touch (phone / tablet):** slide a thumb anywhere on the screen. The plane moves by the amount you slide (relative steering), so your thumb never hides the plane and nothing jumps when you touch down. Holding the on-screen **Up / Down** buttons gives precise, accelerating moves; they can be used with the other thumb.
- **Mouse:** the plane follows the pointer. **Keyboard:** arrows or WASD, Space = play/pause, M = mute.
- Touch devices get quicker plane response, a slightly larger pill pick-up radius, and vibration on hits (menu options: Vibrate, Buttons).

## Leaderboard with Firebase (Vercel)
The game talks only to `/api/scores` (a Vercel function). That function stores everything in a **Firebase Realtime Database** using admin credentials, so the database itself can stay locked and nobody can write fake scores.

1. **Create the project** - https://console.firebase.google.com > Add project > any name (Analytics not needed).
2. **Create the database** - Build > Realtime Database > Create Database > pick a location > **Start in locked mode**. Copy the database URL at the top (like `https://my-game-default-rtdb.firebaseio.com`, or `...europe-west1.firebasedatabase.app`).
3. **Paste the rules** - Realtime Database > Rules tab > replace everything with the text below > Publish:
```
{
  "rules": {
    ".read": false,
    ".write": false,
    "scores": { ".indexOn": ["s"] },
    "used":   { ".indexOn": ".value" }
  }
}
```
4. **Get the admin key** - Project settings (gear icon) > Service accounts > Generate new private key > Generate key. A `.json` file downloads. Keep it private, never put it in the website files or GitHub.
5. **Add 2 variables in Vercel** - your project > Settings > Environment Variables (enable Production, Preview and Development):
   - `FIREBASE_DB_URL` = the database URL from step 2
   - `FIREBASE_SERVICE_ACCOUNT` = open the downloaded `.json` in a text editor, copy **everything** (from the first `{` to the last `}`), paste it as the value
6. **Redeploy** - Deployments > latest > ... > Redeploy (variables only apply to new deployments).
7. **Check** - open `https://your-site.vercel.app/api/scores?debug=1`. You want `"ok":true`, `"read":"ok"`, `"write":"ok"`.

If the check fails, `debug` says what is wrong (missing variable, invalid JSON, wrong URL, permission). Old Redis / Upstash variables are no longer used and can be removed.
Easier alternative to step 4: Project settings > Service accounts > Database secrets > Show, copy the secret and set it as `FIREBASE_SECRET` instead of `FIREBASE_SERVICE_ACCOUNT` (older method, still works).

## Anti-cheat
- **Signed run tickets**: when a flight starts the server issues a signed, single-use ticket bound to the player. A score is only accepted with a valid, unused ticket.
- **Physics check on the server**: distance must fit the real time elapsed (and the time actually played), pills must fit the distance, the score must equal `(distance + 5 x pills) x difficulty multiplier`, and the level must match the distance.
- **In-game guards**: damage, fuel, distance and speed are tracked separately; editing them in the console stops the run ("Cheat detected") and the run is not submitted or rewarded.
- Optional: set `SCORE_SECRET` (any long random string) in Vercel env vars to sign tickets with your own secret.
No browser game can be 100% cheat-proof (the code runs on the player's device), but a faked score now has to look like a real run that took real time.

## Controls
On-screen buttons show while flying on every device: **Up / Down** (bottom right). Dragging a finger, the mouse, arrow keys and WASD still work.

## Gameplay
- Obstacles cover the full flying height, so there is no safe altitude.
- Wave types: scattered spikes (some bob up and down from level 3), full walls with one gate, combs, and orange **homing spikes** that follow your height and lock on shortly before impact. A red "!" shows at the screen edge where one is coming from.
- Staying at the same height for about 2.5 seconds calls in a homing spike. Pills and fuel appear at all heights, often in big waves, so you have to move to collect them.

## Site: vectofly.com
- Domain and email are set everywhere: https://vectofly.com and contact@vectofly.com (canonical links, Open Graph, sitemap, robots, legal pages).
- Google Analytics (G-LXSLC7ZVNW) is in every page. A small notice lets visitors opt out; the Privacy and Cookie pages explain it.
- Pages: how-to-play, leaderboard (full list with search and paging), about, contact, privacy, terms, cookie-policy, disclaimer, dmca, 404. The legal pages are generated from a template, so edit wording in one place if you regenerate them.
- Bug reports and feedback: "Report a bug / send feedback" in the menu and on every page opens an email to contact@vectofly.com with device details filled in.

## Gameplay notes (v7)
- Fully touch based: slide a thumb anywhere. No on-screen buttons.
- Narrow / portrait screens: the world is squeezed horizontally (XS) and the camera is fitted to it, so spikes and the plane stay large and you get the same reaction time as on a monitor. Scoring is unaffected.
- Obstacle director: minimum time between waves (0.8 s, 0.95 s on touch), reachable gates that follow readable patterns, difficulty that adapts to how you play, spikes that avoid pills and fuel, homing spikes and punishment for standing still.
- Free from the start: the 5 cheapest planes and 4 cheapest maps. Daily gift, close-call and pill-combo bonus coins, and a "next unlock" goal in the menu.

## Monetag
- Verify the site in Monetag (meta tag already in every page), paste the Multitag into `js/ads.js` CONFIG, redeploy.
