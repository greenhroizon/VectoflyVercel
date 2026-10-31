// npm install --no-save playwright @sparticuz/chromium (or use your installed Playwright browser)
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  let options = { headless: true };
  try {
    const mod = require("@sparticuz/chromium");
    const binary = mod.default || mod;
    options = {
      executablePath: await binary.executablePath(),
      args: binary.args,
      headless: true,
    };
  } catch (e) {}
  const browser = await chromium.launch(options);
  const sizes = [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1366, 768],
  ];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
    });
    const page = await context.newPage();
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (route) => route.abort());
    await page.addInitScript(() =>
      localStorage.setItem("vectofly_analytics_consent", "no"),
    );
    await page.goto("http://localhost:3000/");
    await page.waitForFunction(
      () =>
        window.game && window.VF && document.querySelector("#playBtn").onclick,
    );
    assert.equal(await page.locator("#ctl").count(), 0);
    const save = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("vectofly_save_v1")),
    );
    assert.ok(save.planes.length >= 5);
    assert.ok(save.maps.length >= 4);
    await page.locator("#hangarBtn").click();
    assert.ok((await page.locator("#grid .card").count()) > 5);
    await page.locator("#backBtn").click();
    await page.locator("#mapsBtn").click();
    assert.ok((await page.locator("#grid .card").count()) > 4);
    await page.locator("#backBtn").click();
    await page.locator("#playBtn").click();
    await page.waitForFunction(() => game.status === "playing");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(500);
    await page.locator("#pauseBtn").click();
    assert.equal(await page.evaluate(() => VF.paused), true);
    await page.locator("#pauseBtn").click();
    const view = await page.evaluate(() => {
      let p = airplane.mesh.position.clone().project(camera);
      return { x: p.x, y: p.y, z: p.z, damage: game.damage };
    });
    assert.ok(
      Math.abs(view.x) < 1 && Math.abs(view.y) < 1 && view.z < 1,
      JSON.stringify(view),
    );
    if (width < 1000) {
      await page.evaluate(() => {
        const target = document.querySelector("canvas");
        const t = { identifier: 1, clientX: 180, clientY: 350, target };
        handleTouchStart({ target, changedTouches: [t] });
        handleTouchMove({
          touches: [{ ...t, clientY: 290 }],
          preventDefault() {},
        });
        handleTouchEnd({ changedTouches: [t] });
      });
      assert.ok(await page.evaluate(() => mousePos.y > 0));
    }
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: process.env.SCREENSHOT_DIR + "/" + width + "x" + height + ".png",
      });
    assert.deepEqual(errors, []);
    console.log("PASS viewport", width, height);
    await context.close();
  }
  const page = await browser.newPage();
  await page.route("https://**/*", (r) => r.abort());
  for (const slug of [
    "about",
    "privacy",
    "terms",
    "cookie-policy",
    "disclaimer",
    "dmca",
    "contact",
    "how-to-play",
    "leaderboard",
  ]) {
    await page.goto("http://localhost:3000/" + slug + ".html");
    assert.ok(await page.locator("h1").textContent());
    assert.equal(
      await page.locator('script[src="js/analytics.js"]').count(),
      1,
    );
  }
  await browser.close();
  console.log("PASS all important pages");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
