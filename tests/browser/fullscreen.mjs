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
