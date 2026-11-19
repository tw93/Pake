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
async function fixture(frame, run, config = {}) {
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
      ({ source, config }) => {
        window.opened = [];
        window.pakeConfig = { url: "https://mail.example.com/", ...config };
        window.__PAKE_NATIVE__ = {
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
        // tauri-plugin-shell 2.3.5 ships this listener in every app: any
        // target="_blank" link goes to the system browser, whether or not
        // the page prevented the click.
        if (window === window.top)
          document.addEventListener("DOMContentLoaded", () => {
            document.body.addEventListener("click", (event) => {
              let node = event.target;
              while (node) {
                if (node.matches("a")) {
                  if (
                    node.href !== "" &&
                    /^https?:\/\//.test(node.href) &&
                    node.target === "_blank"
                  ) {
                    window.__PAKE_NATIVE__.core.invoke("plugin:shell|open", {
                      path: node.href,
                    });
                    event.preventDefault();
                  }
                  break;
                }
                node = node.parentElement;
              }
            });
          });
      },
      { source, config },
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

for (const frame of [false, true]) {
  for (const [label, destination] of [
    ["provider", "https://accounts.google.com/o/oauth2/v2/auth?client_id=1"],
    ["own-site", "https://mail.example.com/googlepopupredirect?flow=popup"],
  ]) {
    // TikTok, Notion and X sign in with Google through a sized popup that
    // answers window.opener; navigating the app there left a blank window.
    test(`${frame ? "frame" : "main"} sized ${label} sign-in popup keeps its opener and the app's page`, async () => {
      await fixture(frame, async (page, target, context) => {
        await target.evaluate((destination) => {
          window.answers = [];
          addEventListener("message", (event) =>
            window.answers.push(event.data),
          );
          document.querySelector("#go").onclick = () => {
            const popup = window.open(
              destination,
              "g_auth_token_window",
              "toolbar=no,location=no,width=590,height=830,top=143.5,left=569",
            );
            window.popupIsSelf = popup === window || popup === window.top;
          };
        }, destination);
        const popupReady = context.waitForEvent("page", { timeout: 3000 });
        await target.locator("#go").click();
        const popup = await popupReady;
        await popup.waitForURL(destination);
        assert.equal(page.url(), "https://mail.example.com/");
        assert.equal(await target.evaluate(() => window.popupIsSelf), false);
        await popup.evaluate(() => window.opener.postMessage("signed-in", "*"));
        await target.waitForFunction(() =>
          window.answers.includes("signed-in"),
        );
        assert.deepEqual(await page.evaluate(() => window.opened), []);
        await popup.close();
      });
    });
  }
}

test("a new-window link the page handled itself opens nothing", async () => {
  // Douyin's episode list with "new windows in the app" on.
  await fixture(
    false,
    async (page, target, context) => {
      await page.evaluate(() => {
        document.body.innerHTML =
          '<div id="root"><a id="episode" href="undefined" target="_blank"><span>Episode 2</span></a></div>';
        window.switched = 0;
        document.querySelector("#root").addEventListener("click", (event) => {
          event.preventDefault();
          window.switched += 1;
        });
      });
      let popups = 0;
      context.on("page", () => (popups += 1));
      await page.locator("#episode span").click();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.switched), 1);
      assert.deepEqual(await page.evaluate(() => window.opened), []);
      assert.equal(popups, 0);
      assert.equal(page.url(), "https://mail.example.com/");
      assert.equal(
        await page.evaluate(() => document.querySelector("#episode").target),
        "_blank",
      );
    },
    { new_window: true },
  );
});

for (const newWindow of [false, true]) {
  test(`a new-tab link that gets its address during a handled click opens nothing (new_window ${newWindow})`, async () => {
    // Douyin's episode covers as they are on the page: no href when the click
    // begins, "undefined" once their own handler has run and prevented it.
    await fixture(
      false,
      async (page, target, context) => {
        await page.evaluate(() => {
          document.body.innerHTML =
            '<div id="root"><a id="episode" target="_blank"><span>Episode 2</span></a></div>';
          window.switched = 0;
          document.querySelector("#root").addEventListener("click", (event) => {
            document.querySelector("#episode").href = undefined;
            event.preventDefault();
            window.switched += 1;
          });
        });
        let popups = 0;
        context.on("page", () => (popups += 1));
        await page.locator("#episode span").click();
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.switched), 1);
        assert.equal(
          await page.evaluate(() => document.querySelector("#episode").href),
          "https://mail.example.com/undefined",
        );
        assert.deepEqual(await page.evaluate(() => window.opened), []);
        assert.equal(popups, 0);
        assert.equal(page.url(), "https://mail.example.com/");
        assert.equal(
          await page.evaluate(() => document.querySelector("#episode").target),
          "_blank",
        );
      },
      { new_window: newWindow },
    );
  });
}

test("a new-window link nobody handled opens in the app, not the browser", async () => {
  await fixture(
    false,
    async (page, target, context) => {
      await page.evaluate(() => {
        document.body.innerHTML =
          '<a id="note" href="/note/2" target="_blank"><span>Note</span></a>';
      });
      const popupReady = context.waitForEvent("page", { timeout: 3000 });
      await page.locator("#note span").click();
      const popup = await popupReady;
      await popup.waitForURL("https://mail.example.com/note/2");
      assert.deepEqual(await page.evaluate(() => window.opened), []);
      assert.equal(page.url(), "https://mail.example.com/");
      await popup.close();
    },
    { new_window: true },
  );
});

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
