// Real DOM coverage for constructible and legacy non-constructible EventTarget.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { test, before, after } from "node:test";

const { chromium } = await import(
  process.env.PAKE_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PAKE_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const source = await Promise.all(
  ["link_policy.js", "event.js"].map((name) =>
    fs.readFile(
      `${process.env.PAKE_INJECT_ROOT || "src-tauri/src/inject"}/${name}`,
      "utf8",
    ),
  ),
);
let browser;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PAKE_BROWSER_EXECUTABLE
      ? { executablePath: process.env.PAKE_BROWSER_EXECUTABLE }
      : {}),
  });
});
after(async () => browser?.close());

for (const legacy of [false, true]) {
  test(`notification event identity, legacy constructor ${legacy}`, async () => {
    const page = await browser.newPage();
    try {
      await page.route("**/*", (route) =>
        route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
      );
      await page.goto("https://pake-notification.test/");
      const result = await page.evaluate(
        async ({ source, legacy }) => {
          if (legacy) {
            window.EventTarget = class extends EventTarget {
              constructor() {
                throw new TypeError("Illegal constructor");
              }
            };
          }
          window.__TAURI__ = {
            core: { invoke: () => Promise.resolve({ nativeClick: true }) },
          };
          for (const script of source) (0, eval)(script);
          class Derived extends Notification {}
          const notification = new Derived("Event identity");
          let calls = 0;
          let exactIdentity = false;
          function once(event) {
            calls++;
            exactIdentity =
              event.target === notification &&
              event.currentTarget === notification &&
              this === notification;
          }
          notification.addEventListener("click", once, { once: true });
          const removed = () => {
            calls += 10;
          };
          notification.addEventListener("click", removed);
          notification.removeEventListener("click", removed);
          await new Promise((resolve) => setTimeout(resolve, 0));
          window.__pakeNotificationClick(notification._id);
          window.__pakeNotificationClick(notification._id);
          notification.close();
          window.__pakeNotificationClick(notification._id);
          return {
            calls,
            exactIdentity,
            notificationInstance: notification instanceof Notification,
            eventTargetInstance: notification instanceof EventTarget,
            derivedInstance: notification instanceof Derived,
          };
        },
        { source, legacy },
      );
      assert.deepEqual(result, {
        calls: 1,
        exactIdentity: true,
        notificationInstance: true,
        eventTargetInstance: true,
        derivedInstance: true,
      });
    } finally {
      await page.close();
    }
  });
}
