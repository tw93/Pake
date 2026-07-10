import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadEventHelpers({
  withTauri = false,
  userAgent = "Mozilla/5.0",
  initialZoom = null,
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
  const eventListeners = {};
  const elementsById = new Map();
  const localStorageValues = new Map();
  if (initialZoom !== null) {
    localStorageValues.set("htmlZoom", initialZoom);
  }
  const registerListener = (type, handler, options) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push({ handler, options });
  };
  const createElement = (tagName = "div") => ({
    tagName: tagName.toUpperCase(),
    style: {},
    children: [],
    addEventListener: () => {},
    appendChild(child) {
      this.children.push(child);
      if (child.id) elementsById.set(child.id, child);
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      if (child.id) elementsById.delete(child.id);
    },
    click: () => {},
    set id(value) {
      this._id = value;
      elementsById.set(value, this);
    },
    get id() {
      return this._id;
    },
  });
  const body = createElement("body");
  body.scrollHeight = 0;

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
        getItem: (key) => localStorageValues.get(key) ?? null,
        setItem: (key, value) => {
          localStorageValues.set(key, value);
        },
      },
      addEventListener: registerListener,
      dispatchEvent: () => {},
      open: () => ({}),
      isAuthLink: () => false,
      isAuthPopup: () => false,
      pakeConfig: {},
    },
    document: {
      addEventListener: registerListener,
      createElement,
      getElementById: (id) => elementsById.get(id) || null,
      getElementsByTagName: () => [{ style: {} }],
      body,
      execCommand: () => {},
    },
  };
  context.window.navigator = context.navigator;
  if (withTauri) {
    context.window.__TAURI__ = {
      core: { invoke },
      window: {
        getCurrentWindow: () => ({
          startDragging: () => {},
          isFullscreen: () => Promise.resolve(false),
          setFullscreen: () => {},
        }),
      },
    };
  }

  runInNewContext(source, context);
  return { ...context, eventListeners, invokeCalls, localStorageValues };
}

function runDomReady(context) {
  context.eventListeners.DOMContentLoaded[0].handler();
}

function getClickGuard(context) {
  return context.eventListeners.click.find(
    ({ handler }) => handler.name === "detectAnchorElementClick",
  ).handler;
}

function makeAnchor(href, target = "_blank") {
  return {
    href,
    target,
    download: "",
    getAttribute: (name) => (name === "href" ? href : ""),
  };
}

function makeClickEvent(anchor) {
  return {
    target: {
      closest: () => anchor,
    },
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

describe("event link guard", () => {
  it("falls back from malformed saved zoom values", () => {
    const context = loadEventHelpers({
      withTauri: true,
      initialZoom: "not-a-zoom",
    });

    context.zoomIn();
    context.zoomOut();

    expect(context.invokeCalls).toEqual([
      ["set_zoom", { percent: 110 }],
      ["set_zoom", { percent: 100 }],
    ]);
    expect(context.localStorageValues.get("htmlZoom")).toBe("100%");
  });

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

  it("keeps named Apple auth popups on the native popup path on macOS", () => {
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
      "https://example.com/apple/login",
      "AppleAuthentication",
      "width=1200,height=800",
    );

    expect(openCalls).toEqual([
      {
        url: "https://example.com/apple/login",
        name: "AppleAuthentication",
        specs: "width=1200,height=800",
      },
    ]);
    expect(window.location.href).toBe("https://example.com/app");
    expect(result).toBe(popup);
  });

  it("keeps appleid auth URL popups on the native popup path on macOS", () => {
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
      "https://appleid.apple.com/auth/authorize",
      "_blank",
      "width=1200,height=800",
    );

    expect(openCalls).toEqual([
      {
        url: "https://appleid.apple.com/auth/authorize",
        name: "_blank",
        specs: "width=1200,height=800",
      },
    ]);
    expect(window.location.href).toBe("https://example.com/app");
    expect(result).toBe(popup);
  });

  it("falls back to current-window navigation if an Apple auth popup is blocked", () => {
    const { openAuthNavigation, window } = loadEventHelpers({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5)",
    });
    const originalWindowOpen = vi.fn(() => null);

    const result = openAuthNavigation(
      originalWindowOpen,
      "https://appleid.apple.com/auth/authorize",
      "_blank",
      "width=1200,height=800",
    );

    expect(originalWindowOpen).toHaveBeenCalledWith(
      "https://appleid.apple.com/auth/authorize",
      "_blank",
      "width=1200,height=800",
    );
    expect(window.location.href).toBe(
      "https://appleid.apple.com/auth/authorize",
    );
    expect(result).toBe(window);
  });

  it("navigates target blank auth links in-place when new-window is disabled", () => {
    const context = loadEventHelpers({ withTauri: true });
    context.window.pakeConfig = { new_window: false };
    context.window.isAuthLink = (url) => url.includes("okta.com");
    runDomReady(context);

    const event = makeClickEvent(
      makeAnchor("https://mycompany.okta.com/sso", "_blank"),
    );
    getClickGuard(context)(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    expect(context.window.location.href).toBe("https://mycompany.okta.com/sso");
  });

  it("retargets internal target=_blank links to _self instead of forcing a reload", () => {
    const context = loadEventHelpers({ withTauri: true });
    context.window.pakeConfig = {
      new_window: false,
      internal_url_regex: "^https://app\\.example\\.com",
    };
    runDomReady(context);

    const anchor = makeAnchor("https://app.example.com/callback", "_blank");
    const event = makeClickEvent(anchor);
    getClickGuard(context)(event);

    // The link must be neutralized so the native webview never opens a system
    // browser window, but the page's own click handler (and a normal in-app
    // navigation) should still run -- so we do NOT preventDefault / reload.
    expect(anchor.target).toBe("_self");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(context.window.location.href).toBe("https://example.com/app");
  });

  it("still opens external target=_blank links in the system browser", () => {
    const context = loadEventHelpers({ withTauri: true });
    context.window.pakeConfig = { new_window: false };
    runDomReady(context);

    const anchor = makeAnchor("https://other.example.org/page", "_blank");
    const event = makeClickEvent(anchor);
    getClickGuard(context)(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    expect(context.invokeCalls).toContainEqual([
      "plugin:shell|open",
      { path: "https://other.example.org/page" },
    ]);
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

describe("getFilenameFromUrl data URI extension", () => {
  it("maps a structured image subtype to a real extension (svg+xml -> svg)", () => {
    const context = loadEventHelpers();
    const filename = context.getFilenameFromUrl(
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    );
    expect(filename).toMatch(/^image-.*\.svg$/);
    expect(filename).not.toContain("+");
  });

  it("normalizes jpeg to jpg", () => {
    const context = loadEventHelpers();
    expect(context.getFilenameFromUrl("data:image/jpeg;base64,AAAA")).toMatch(
      /^image-.*\.jpg$/,
    );
  });

  it("does not fold the data payload into the extension when ';' is absent", () => {
    const context = loadEventHelpers();
    const filename = context.getFilenameFromUrl("data:image/png,rawdata");
    expect(filename).toMatch(/^image-.*\.png$/);
    expect(filename).not.toContain("data:image/");
  });
});
