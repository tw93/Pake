// Real WindowProxy and DOM propagation coverage for two-stage popups and links.
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
  ["link_policy.js", "auth.js", "frame_links.js", "event.js"].map((name) =>
    fs.readFile(
      `${process.env.PAKE_INJECT_ROOT || "src-tauri/src/inject"}/${name}`,
      "utf8",
    ),
  ),
);
async function fixture(frame, run) {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PAKE_BROWSER_EXECUTABLE
      ? { executablePath: process.env.PAKE_BROWSER_EXECUTABLE }
      : {}),
  });
  try {
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<html><body><button id="go">Open</button></body></html>',
      }),
    );
    await context.addInitScript(
      ({ source }) => {
        window.opened = [];
        window.pakeConfig = { url: "https://mail.example.com/" };
        window.__TAURI__ = {
          core: {
            invoke: (cmd, args) => {
              if (cmd === "plugin:shell|open") window.opened.push(args.path);
              return Promise.resolve();
            },
          },
          window: { getCurrentWindow: () => ({}) },
        };
        for (const script of window === window.top
          ? source
          : source.slice(0, 3))
          (0, eval)(script);
      },
      { source },
    );
    const page = await context.newPage();
    await page.goto("https://mail.example.com/");
    if (frame) {
      await page.evaluate(() => {
        const el = document.createElement("iframe");
        el.src = "/message";
        document.body.append(el);
      });
      await page.waitForFunction(() =>
        document.querySelector("iframe")?.contentDocument?.querySelector("#go"),
      );
    }
    await run(page, frame ? page.frames()[1] : page, context);
  } finally {
    await browser.close();
  }
}
for (const frame of [false, true]) {
  for (const raw of [undefined, "", "about:blank", "about:blank#download"]) {
    test(`${frame ? "frame" : "main"} blank ${String(raw)} preserves delayed popup navigation`, async () => {
      await fixture(frame, async (page, target, context) => {
        await target.evaluate((raw) => {
          document.querySelector("#go").onclick = () => {
            const popup =
              raw === undefined ? window.open() : window.open(raw, "_blank");
            window.popupIsMain = popup === window.top;
            if (popup)
              setTimeout(() => {
                popup.location.href = "https://files.example.net/preview";
              }, 20);
          };
        }, raw);
        const popupReady = context.waitForEvent("page", { timeout: 3000 });
        await target.locator("#go").click();
        const popup = await popupReady;
        await popup.waitForURL("https://files.example.net/preview");
        assert.equal(page.url(), "https://mail.example.com/");
        assert.equal(await target.evaluate(() => window.popupIsMain), false);
        assert.deepEqual(await page.evaluate(() => window.opened), []);
        await popup.close();
      });
    });
  }
  for (const destination of [
    "https://outside.example.net/article",
    "https://outside.example.net/track?next=https://service.example.net/login",
    "https://outside.example.net/login-tips",
    "https://outside.example.net/article#/signin",
  ]) {
    test(`${frame ? "frame" : "main"} external click reaches the browser once: ${destination}`, async () => {
      await fixture(frame, async (page, target) => {
        await target.evaluate((href) => {
          document.body.innerHTML =
            '<a id="link" target="_blank"><span>Link</span></a>';
          document.querySelector("#link").href = href;
        }, destination);
        await target.locator("#link span").click();
        await page.waitForFunction(() => window.opened.length > 0, null, {
          timeout: 1500,
        });
        assert.equal(page.url(), "https://mail.example.com/");
        assert.deepEqual(await page.evaluate(() => window.opened), [
          destination,
        ]);
      });
    });
  }
}

for (const destination of [
  "https://slack.com/openid/connect/authorize?client_id=123",
  "https://identity.example/connect/authorize",
  "https://tenant.auth0.com/u/login/identifier",
]) {
  test(`nested authentication remains in the app: ${destination}`, async () => {
    await fixture(false, async (page) => {
      await page.evaluate((href) => {
        document.body.innerHTML = '<a id="link" target="_blank">Sign in</a>';
        document.querySelector("#link").href = href;
      }, destination);
      await page.locator("#link").click();
      await page.waitForURL(destination);
      assert.deepEqual(await page.evaluate(() => window.opened), []);
    });
  });
}
