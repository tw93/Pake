import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function loadEventHelpers({
  withTauri = false,
  userAgent = "Mozilla/5.0",
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/event.js"),
    "utf-8",
  );

  const invokeCalls = [];
  const invoke = (command, payload) => {
    invokeCalls.push([command, payload]);
    return Promise.resolve();
  };

  const context = {
    console,
    URL,
    Event: class {},
    Notification: function Notification() {},
    setTimeout,
    clearTimeout,
    scrollTo: () => {},
    navigator: {
      userAgent,
      language: "en-US",
    },
    window: {
      history: {
        back: () => {},
        forward: () => {},
      },
      location: {
        href: "https://example.com/app",
        origin: "https://example.com",
        pathname: "/app",
        reload: () => {},
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
      addEventListener: () => {},
      dispatchEvent: () => {},
    },
    document: {
      addEventListener: () => {},
      getElementsByTagName: () => [{ style: {} }],
      body: {
        style: {},
        scrollHeight: 0,
      },
      execCommand: () => {},
    },
  };
  context.window.navigator = context.navigator;
  if (withTauri) {
    context.window.__TAURI__ = { core: { invoke } };
  }

  runInNewContext(source, context);
  return { ...context, invokeCalls };
}

describe("event link guard", () => {
  it("bypasses javascript pseudo-links", () => {
    const { shouldBypassPakeLinkHandling } = loadEventHelpers();

    expect(shouldBypassPakeLinkHandling("javascript:void(0)")).toBe(true);
  });

  it("bypasses hash-only anchors", () => {
    const { shouldBypassPakeLinkHandling } = loadEventHelpers();

    expect(shouldBypassPakeLinkHandling("#captcha-confirm")).toBe(true);
  });

  it("keeps normal navigations under Pake handling", () => {
    const { shouldBypassPakeLinkHandling } = loadEventHelpers();

    expect(shouldBypassPakeLinkHandling("https://example.com/account")).toBe(
      false,
    );
  });

  it("navigates macOS auth URLs in the current window", () => {
    const { openAuthNavigation, window } = loadEventHelpers({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5)",
    });
    const openCalls = [];
    const originalWindowOpen = (url, name, specs) => {
      openCalls.push({ url, name, specs });
      return {};
    };

    const result = openAuthNavigation(
      originalWindowOpen,
      "https://www.linkedin.com/login",
      "_blank",
      "width=1200,height=800",
    );

    expect(openCalls).toEqual([]);
    expect(window.location.href).toBe("https://www.linkedin.com/login");
    expect(result).toBe(window);
  });

  it("keeps blank macOS auth popups on the native popup path", () => {
    const popup = {};
    const { openAuthNavigation, window } = loadEventHelpers({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5)",
    });
    const openCalls = [];
    const originalWindowOpen = (url, name, specs) => {
      openCalls.push({ url, name, specs });
      return popup;
    };

    const result = openAuthNavigation(
      originalWindowOpen,
      "about:blank",
      "login",
      "width=1200,height=800",
    );

    expect(openCalls).toEqual([
      {
        url: "about:blank",
        name: "login",
        specs: "width=1200,height=800",
      },
    ]);
    expect(window.location.href).toBe("https://example.com/app");
    expect(result).toBe(popup);
  });

  it("bridges Web Badging API calls to explicit badge commands", async () => {
    const { navigator, invokeCalls } = loadEventHelpers({ withTauri: true });

    await navigator.setAppBadge(3.8);
    await navigator.setAppBadge();
    await navigator.setAppBadge(0);

    expect(invokeCalls).toEqual([
      ["set_dock_badge", { count: 3 }],
      ["set_dock_badge_label", { label: "•" }],
      ["clear_dock_badge", undefined],
    ]);
  });

  it("keeps notification display separate from badge increment", async () => {
    const { window, invokeCalls } = loadEventHelpers({ withTauri: true });

    new window.Notification("Hello", { body: "World", icon: "/icon.png" });
    await Promise.resolve();
    await Promise.resolve();

    expect(invokeCalls).toEqual([
      [
        "send_notification",
        {
          params: {
            title: "Hello",
            body: "World",
            icon: "https://example.com/icon.png",
          },
        },
      ],
      ["increment_dock_badge", undefined],
    ]);
  });
});
