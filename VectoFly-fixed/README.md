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
        "n": { ".validate": "newData.isString() && newData.val().length <= 12" },
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

## What is in the box
- `js/game.js` core loop: flat endless world, obstacles, **damage** meter, fuel
- `js/world.js` flat scrolling ground + scenery for every map
- `js/planes.js` plane models and paint patterns
- `js/vectofly.js` hangar (planes / paints / maps), leaderboard, audio, saves

## Difficulty
Easy / Medium / Hard / Hell is chosen on the menu (saved per device). Harder modes hit harder, spawn bigger and closer waves, speed up faster and burn fuel quicker, but multiply score and coins (x1 / x1.25 / x1.5 / x2). Tune them in the `DIFFS` table in `js/vectofly.js`.

## SEO setup (do this before launch)
1. Set your domain everywhere (index.html, how-to-play.html, privacy.html, robots.txt, sitemap.xml):
   `sh set-domain.sh https://vectofly.com`   (no trailing slash)
2. Upload the whole folder. Apache hosts use `.htaccess`, Netlify/Cloudflare Pages use `_headers`, Node hosts use `server/server.js`.
3. Google Search Console: add the site, submit `https://vectofly.com/sitemap.xml`, then "Request indexing" for the home page.
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
4. Check `https://vectofly.com/api/scores` shows `{"scores":[]}`. The World tab appears in the game.
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
7. **Check** - open `https://vectofly.com/api/scores?debug=1`. You want `"ok":true`, `"read":"ok"`, `"write":"ok"`.

If the check fails, `debug` says what is wrong (missing variable, invalid JSON, wrong URL, permission). Old Redis / Upstash variables are no longer used and can be removed.
Easier alternative to step 4: Project settings > Service accounts > Database secrets > Show, copy the secret and set it as `FIREBASE_SECRET` instead of `FIREBASE_SERVICE_ACCOUNT` (older method, still works).

## Anti-cheat
- **Signed run tickets**: when a flight starts the server issues a signed, single-use ticket bound to the player. A score is only accepted with a valid, unused ticket.
- **Physics check on the server**: distance must fit the real time elapsed (and the time actually played), pills must fit the distance, the score must equal `(distance + 5 x pills) x difficulty multiplier`, and the level must match the distance.
- **In-game guards**: damage, fuel, distance and speed are tracked separately; editing them in the console stops the run ("Cheat detected") and the run is not submitted or rewarded.
- Optional: set `SCORE_SECRET` (any long random string) in Vercel env vars to sign tickets with your own secret.
No browser game can be 100% cheat-proof (the code runs on the player's device), but a faked score now has to look like a real run that took real time.

## Updated controls and fairness
- Touch: relative drag on the sky, with no directional buttons. Lift and re-anchor without jumping.
- Desktop: mouse, arrows or WASD; P pauses, M mutes, Space/Enter starts from the menu.
- A visible pause/resume button is available during flights. Switching away pauses the game.
- Stable camera framing fits the flight band on portrait and landscape screens. Speed is bounded by visible reaction time.
- Each obstacle column reserves a wide corridor. Adjacent gates move at most one lane; punitive seekers no longer spawn.
- First five aircraft and first four maps are granted without removing purchases or resetting the wallet.

## Website and analytics
Canonical site: https://vectofly.com. Support: contact@vectofly.com.
`leaderboard.html` browses retained global scores in pages of 50. Both server implementations accept `limit` and `offset`, return absolute ranks, total and hasMore, and retain at most 5,000 best-per-player entries.
The flight board and menu show the Top 50 only. An unfinished local run is never presented as a verified global ranking.
GA4 G-LXSLC7ZVNW is loaded once through `js/analytics.js`, only after opt-in. Preferences are accessible on each page. Page views and non-identifying gameplay events are configured. Production receipt still needs verification in GA4 Realtime/DebugView after deployment.

## Quality checks
Run `npm test` for dependency-free camera, wave-generation, touch, movement, link, save and API tests.
Optional browser checks: install `playwright` and its Chromium browser, then run `npm run test:browser` against the bundled server on port 3000. `@sparticuz/chromium` is an optional alternative binary.
See `UPGRADE_NOTES.md` for implementation details and remaining production QA.
