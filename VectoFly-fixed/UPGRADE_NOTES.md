# VectoFly upgrade — 31 October 2026

## Implementation

This is an in-place upgrade, not a replacement engine. Three.js models, procedural worlds, damage/fuel loop, earned coins, difficulty multipliers, signed score tickets and existing save keys remain.

### Gameplay and mobile
- Stable perspective camera fits the full flight band and a minimum horizontal preview. Steering no longer zooms the camera or pans it vertically.
- Viewport-dependent spawn boundary and a speed ceiling preserve approximately 1.4 seconds of visible reaction time. Existing distance-based score/anti-cheat calculations remain intact.
- Wave generation protects a wide corridor. Adjacent gates move at most one lane, with wall/scatter variations. Punitive idle-triggered seekers and bobbing spikes no longer appear in generated waves; legacy renderer support is retained.
- Swept relative-motion collision detects spikes crossing the aircraft between frames. Knockback is bounded and avoids division by zero. Vertical position stays within the flight band.
- Exponential steering smoothing is less sensitive to frame rate. Relative drag does not jump on touchdown, supports touch identifiers and cancellation, and ignores menus, links, controls and leaderboard interaction.
- Removed directional control DOM, listeners, setting and CSS. Keyboard/mouse input remains. Added a visible pause/resume button and clear stuck keys on window blur.
- Mobile shadow rendering is disabled; pixel-ratio limits and object pools remain. Old aircraft geometries and materials are released without disposing shared paint textures.
- Responsive scrollable menu/hangar, touch target improvements, safe-area spacing, compact cockpit HUD. The mini-board is intentionally hidden on small flight screens to keep the path unobstructed; the Top 50 remains available in the menu.

### Progress and rankings
- First five aircraft in the existing catalog (Paper Plane, Mustang, Red Baron, Autogyro, Lightning) and first four maps (Sunny Coast, Sunset Bay, Tropical Lagoon, Arctic) are granted additively. Classic remains available as before. Existing coins and paid unlocks are retained.
- Free / Unlocked / Locked labels in the hangar. Easy is the default only for new players; saved difficulty remains unchanged.
- Fixed a migration bug where a valid zero-flight current save could be replaced by legacy data.
- Menu and flight boards use the Top 50 verified global entries, not a fabricated rank for an unfinished run.
- New full leaderboard with pages of 50, absolute ranks, current-player highlighting when a public player key is available, error/retry UI and navigation.
- Both APIs support offset/limit pagination, deterministic tie ordering and totals. The existing 5,000-entry retention bound is preserved; “all” means all retained ranked entries, not historical discarded scores.
- The Vercel implementation reads the retained board before slicing so tied scores are consistent across pages. This is bounded but may warrant cursor/index redesign if retention grows substantially.

### Website and data
- Updated canonical/social/schema URLs, robots, sitemap, support address and domain utility.
- Reworked About, Contact, Instructions, Privacy, Terms, Cookies, Disclaimer and Copyright/DMCA pages with shared styling/navigation and implementation-specific content. No claim of verified legal compliance or registered DMCA-agent status.
- Feedback uses a clearly labelled mailto link, not an unimplemented form.
- Shared GA4 loader for G-LXSLC7ZVNW, loaded once per page after optional consent, with a persistent preference control. Configures page views and non-identifying game start/end and aircraft/map selection events plus full leaderboard visits. Does not send public names, player IDs or emails as event parameters. Existing CrazyGames integration is disclosed.

## Files
- Game/UI: `index.html`, `js/game.js`, `js/vectofly.js`, `js/config.js`, `css/vectofly.css`.
- Leaderboard: `api/scores.js`, `server/server.js`, new `leaderboard.html`, new `js/leaderboard.js`.
- Analytics: new `js/analytics.js`; loader included in every HTML page including 404.
- Content: `about.html`, `contact.html`, `how-to-play.html`, `privacy.html`, `terms.html`, `cookie-policy.html`, `disclaimer.html`, `dmca.html`, `404.html`, `css/seo.css`.
- Metadata/docs: `robots.txt`, `sitemap.xml`, `set-domain.sh`, `README.md`, `package.json`, this file.
- Tests: `tests/core.test.cjs`, `tests/services.test.cjs`, optional `tests/browser.cjs`.

## Verification performed
- `npm test`: 10 automated checks pass, covering five viewport projections (320×568, 390×844, 844×390, 768×1024, 1366×768), 10,000 fair-wave samples, touch/re-anchor/cancel behavior, movement bounds, swept collision, five free aircraft geometry builds, current/legacy save handling and additive unlock grants, local links/analytics loader presence, real Node HTTP pagination with 125 seeded players, and mocked Firebase/Vercel pagination.
- `node --check` for changed application/server scripts and `git diff --check`.
- Local Node game/score server starts successfully, bound to all interfaces. Test data stays outside the repository.

## Remaining verification before production sign-off
- Browser automation was attempted but could not launch in this sandbox: Playwright browser download is network-restricted; an alternate npm-distributed Chromium lacks system `libnspr4.so`. The optional browser smoke test is included but **has not passed** here.
- Real iOS Safari/Android Chrome drag input, orientation/address-bar resizing, visual overlap, every map's rendered scenery, audio, FPS and long-run difficulty need hands-on device QA. Mathematical viewport tests are not a substitute for these checks.
- Real Firebase credentials are not available in this environment. Verify the deployed API, concurrency under load, signed score submission and rankings against the production database. The mocked Firebase test does not prove live connectivity.
- Confirm page views/events in GA4 Realtime/DebugView after consenting on the deployed domain. No claim of receipt in Google Analytics is made here.
- These changes are not deployed automatically. Review policy wording against actual hosting/provider settings and obtain qualified legal advice where appropriate. Confirm contact@vectofly.com receives mail.
