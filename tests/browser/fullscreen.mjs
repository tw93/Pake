// Native DOM fullscreen must retain player controls and exit through F11.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
const { chromium } = await import(
  process.env.PAKE_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PAKE_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const source = await Promise.all(
  ["link_policy.js", "auth.js", "event.js"].map((name) =>
    fs.readFile(
      `${process.env.PAKE_INJECT_ROOT || "src-tauri/src/inject"}/${name}`,
      "utf8",
    ),
  ),
);
test("native fullscreen preserves the player subtree and F11 exits its top layer", async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PAKE_BROWSER_EXECUTABLE
      ? { executablePath: process.env.PAKE_BROWSER_EXECUTABLE }
      : {}),
  });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ source }) => {
        Object.defineProperty(navigator, "platform", { value: "Win32" });
        Object.defineProperty(navigator, "userAgentData", {
          value: { platform: "Windows" },
        });
        window.pakeConfig = { url: "https://video.example.com/" };
        window.__TAURI__ = {
          core: { invoke: () => Promise.resolve() },
          window: {
            getCurrentWindow: () => ({
              isFullscreen: async () => !!document.fullscreenElement,
              setFullscreen: async () => {},
            }),
          },
        };
        for (const script of source) (0, eval)(script);
      },
      { source },
    );
    await context.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `
      <style>#player{width:320px;height:180px}#player:fullscreen{background:black}
      #controls{position:absolute;bottom:20px;left:20px}</style>
      <section id="player"><video></video><button id="controls">Pause</button></section>
      <button id="enter" onclick="document.querySelector('#player').requestFullscreen()">Fullscreen</button>`,
      }),
    );
    const page = await context.newPage();
    await page.goto("https://video.example.com/");
    await page.locator("#enter").click();
    await page.waitForFunction(
      () => document.fullscreenElement?.id === "player",
    );
    assert.equal(
      await page.evaluate(() => {
        const player = document.querySelector("#player");
        const controls = document.querySelector("#controls");
        const rect = controls.getBoundingClientRect();
        return (
          player.matches(":fullscreen") &&
          player.contains(controls) &&
          player.contains(document.querySelector("video")) &&
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ) === controls
        );
      }),
      true,
    );
    await page.keyboard.press("F11");
    await page.waitForFunction(
      () => document.fullscreenElement === null,
      null,
      {
        timeout: 3000,
      },
    );
    assert.equal(await page.locator("#player > video").count(), 1);
  } finally {
    await browser.close();
  }
});

// The Linux/macOS polyfill must keep video and controls in the same subtree,
// including sites that request fullscreen on the document instead of the player.
for (const target of ["html", "body", "#player"]) {
  test(`polyfill preserves player controls when ${target} requests fullscreen`, async () => {
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PAKE_BROWSER_EXECUTABLE
        ? { executablePath: process.env.PAKE_BROWSER_EXECUTABLE }
        : {}),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 900, height: 600 },
      });
      await page.setContent(`
        <style>body{margin:0}#player{position:relative;width:100vw;height:100vh;background:#222}
        video{width:100%;height:100%}#preview{width:80px;height:45px;position:fixed;top:0;right:0}#controls{position:absolute;bottom:20px;left:20px;z-index:10}</style>
        <section id="player"><video></video><button id="controls">Pause</button></section><video id="preview"></video>`);
      await page.evaluate(() => {
        let fullscreen = false;
        window.__TAURI__ = {
          window: {
            getCurrentWindow: () => ({
              setFullscreen: async (value) => {
                fullscreen = value;
              },
              isFullscreen: async () => fullscreen,
            }),
          },
        };
      });
      await page.addScriptTag({
        content: await fs.readFile(
          `${process.env.PAKE_INJECT_ROOT || "src-tauri/src/inject"}/fullscreen.js`,
          "utf8",
        ),
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.evaluate(
          (selector) => document.querySelector(selector).requestFullscreen(),
          target,
        );
        assert.equal(
          await page.evaluate((selector) => {
            const player = document.querySelector("#player");
            const controls = document.querySelector("#controls");
            const rect = controls.getBoundingClientRect();
            return (
              document.fullscreenElement === document.querySelector(selector) &&
              player.contains(document.querySelector("video")) &&
              document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              ) === controls
            );
          }, target),
          true,
        );
        if (target !== "#player") {
          assert.deepEqual(
            await page.locator("#preview").evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return [rect.width, rect.height];
            }),
            [80, 45],
          );
        }
        await page.evaluate(() => document.exitFullscreen());
        assert.equal(
          await page.evaluate(() => document.fullscreenElement),
          null,
        );
        assert.equal(await page.locator("#player > video").count(), 1);
        assert.equal(await page.locator(".pake-fullscreen-element").count(), 0);
        assert.equal(
          await page.evaluate(
            () => document.body.parentElement === document.documentElement,
          ),
          true,
        );
      }
    } finally {
      await browser.close();
    }
  });
}
