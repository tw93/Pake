// Exercise real DOM propagation; VM click mocks cannot detect stolen page menus.
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
    fs.readFile(`src-tauri/src/inject/${name}`, "utf8"),
  ),
);
for (const frame of [false, true]) {
  for (const protocol of ["mailto:person@example.com", "tel:+123456789"]) {
    for (const handled of [false, true]) {
      test(`${frame ? "frame" : "main"} ${protocol} page handles=${handled}`, async () => {
        const browser = await chromium.launch({
          headless: true,
          ...(process.env.PAKE_BROWSER_EXECUTABLE
            ? { executablePath: process.env.PAKE_BROWSER_EXECUTABLE }
            : {}),
        });
        try {
          const page = await browser.newPage();
          await page.route("**/*", (route) =>
            route.fulfill({
              contentType: "text/html",
              body:
                '<html><body><a id="link" href="' +
                protocol +
                '"><span>Address</span></a></body></html>',
            }),
          );
          await page.addInitScript(
            ({ source }) => {
              window.opened = [];
              window.pakeConfig = { url: "https://mail.example.com/" };
              window.__PAKE_NATIVE__ = {
                core: {
                  invoke: (cmd, args) => {
                    if (cmd === "plugin:shell|open")
                      window.opened.push(args.path);
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
          await page.goto("https://mail.example.com/");
          if (frame)
            await page.evaluate(() => {
              const el = document.createElement("iframe");
              el.src = "/message";
              document.body.append(el);
            });
          if (frame)
            await page.waitForFunction(
              () =>
                document.querySelector("iframe")?.contentDocument
                  ?.readyState === "complete" &&
                document
                  .querySelector("iframe")
                  .contentDocument.querySelector("#link"),
            );
          const target = frame ? page.frames()[1] : page;
          await target.evaluate((handled) => {
            window.menu = 0;
            document.addEventListener("click", (e) => {
              if (handled) {
                window.menu++;
                e.preventDefault();
              }
            });
          }, handled);
          await target.locator("#link span").click();
          // Message delivery to the parent is asynchronous.
          if (!handled)
            await page.waitForFunction(() => window.opened.length > 0);
          assert.equal(
            await target.evaluate(() => window.menu),
            handled ? 1 : 0,
          );
          assert.deepEqual(
            await page.evaluate(() => window.opened),
            handled ? [] : [protocol],
          );
        } finally {
          await browser.close();
        }
      });
    }
  }
}
