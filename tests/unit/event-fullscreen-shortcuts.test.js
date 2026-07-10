import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function createElement(tagName = "div") {
  return {
    tagName: tagName.toUpperCase(),
    style: {},
    children: [],
    isContentEditable: false,
    addEventListener: () => {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
    },
    set id(value) {
      this._id = value;
    },
    get id() {
      return this._id;
    },
  };
}

function loadEventHelpers({
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  platform = "Win32",
  disabledWebShortcuts = false,
  initialFullscreen = false,
  hideTitleBar = false,
  hideWindowDecorations = false,
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/event.js"),
    "utf-8",
  );

  const eventListeners = {};
  const elementsById = new Map();
  const fullscreenCalls = [];
  const body = createElement("body");
  body.appendChild = (child) => {
    body.children.push(child);
    if (child.id) elementsById.set(child.id, child);
    return child;
  };

  const registerListener = (type, handler, options) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push({ handler, options });
  };

  let isFullscreen = initialFullscreen;

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
      platform,
      language: "en-US",
      clipboard: {
        readText: () => Promise.resolve(""),
      },
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
      addEventListener: registerListener,
      dispatchEvent: () => {},
      getSelection: () => ({
        toString: () => "",
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      }),
      open: () => ({}),
      isAuthLink: () => false,
      isAuthPopup: () => false,
      pakeConfig: {
        disabled_web_shortcuts: disabledWebShortcuts,
        hide_title_bar: hideTitleBar,
        hide_window_decorations: hideWindowDecorations,
      },
      __TAURI__: {
        core: {
          invoke: () => Promise.resolve(),
        },
        window: {
          getCurrentWindow: () => ({
            startDragging: () => {},
            isFullscreen: () => Promise.resolve(isFullscreen),
            setFullscreen: (value) => {
              fullscreenCalls.push(value);
              isFullscreen = value;
              return Promise.resolve();
            },
          }),
        },
      },
    },
    document: {
      addEventListener: registerListener,
      createElement: (tagName) => {
        const element = createElement(tagName);
        if (element.id) elementsById.set(element.id, element);
        return element;
      },
      createRange: () => ({
        selectNodeContents: vi.fn(),
      }),
      getElementById: (id) => elementsById.get(id) || null,
      getElementsByTagName: () => [{ style: {} }],
      body,
      activeElement: body,
      execCommand: () => true,
    },
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);
  eventListeners.DOMContentLoaded[0].handler();

  return {
    ...context,
    eventListeners,
    fullscreenCalls,
    get isFullscreen() {
      return isFullscreen;
    },
  };
}

function getFullscreenShortcutHandler(context) {
  return context.eventListeners.keydown.find(
    ({ handler }) => handler.name === "handleWindowFullscreenShortcut",
  ).handler;
}

function createKeyEvent(key, overrides = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isTrusted: true,
    repeat: false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    ...overrides,
  };
}

describe("event fullscreen shortcuts", () => {
  it("toggles native fullscreen on F11 for Windows", async () => {
    const context = loadEventHelpers();
    const handler = getFullscreenShortcutHandler(context);
    const event = createKeyEvent("F11");

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([true]);
  });

  it("exits native fullscreen on F11 when already fullscreen", async () => {
    const context = loadEventHelpers({ initialFullscreen: true });
    const handler = getFullscreenShortcutHandler(context);
    const event = createKeyEvent("F11");

    handler(event);

    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([false]);
  });

  it("toggles native fullscreen on F11 for Linux", async () => {
    const context = loadEventHelpers({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      platform: "Linux x86_64",
    });
    const handler = getFullscreenShortcutHandler(context);
    const event = createKeyEvent("F11");

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([true]);
  });

  it("does not register fullscreen shortcuts when web shortcuts are disabled", () => {
    const context = loadEventHelpers({ disabledWebShortcuts: true });

    expect(
      context.eventListeners.keydown?.find(
        ({ handler }) => handler.name === "handleWindowFullscreenShortcut",
      ),
    ).toBeUndefined();
  });

  it("does not handle F11 on macOS", async () => {
    const context = loadEventHelpers({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
    });
    const handler = getFullscreenShortcutHandler(context);
    const event = createKeyEvent("F11");

    handler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([]);
  });

  it("does not claim Alt+Enter from hosted web apps", async () => {
    const context = loadEventHelpers();
    const handler = getFullscreenShortcutHandler(context);
    const event = createKeyEvent("Enter", { altKey: true });

    handler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([]);
  });

  it("ignores synthetic and repeated F11 events", async () => {
    const context = loadEventHelpers();
    const handler = getFullscreenShortcutHandler(context);

    handler(createKeyEvent("F11", { isTrusted: false }));
    handler(createKeyEvent("F11", { repeat: true }));

    await Promise.resolve();
    expect(context.fullscreenCalls).toEqual([]);
  });

  it("creates the drag region only for the active platform flag", () => {
    const windowsWithMacFlag = loadEventHelpers({ hideTitleBar: true });
    const windowsWithDecorationsFlag = loadEventHelpers({
      userAgent: "CustomBrowser/1.0",
      platform: "Win32",
      hideWindowDecorations: true,
    });
    const macUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
    const macWithDecorationsFlag = loadEventHelpers({
      userAgent: macUserAgent,
      platform: "MacIntel",
      hideWindowDecorations: true,
    });
    const macWithTitleBarFlag = loadEventHelpers({
      userAgent: macUserAgent,
      platform: "MacIntel",
      hideTitleBar: true,
    });

    expect(
      windowsWithMacFlag.document.getElementById("pake-top-dom"),
    ).toBeNull();
    expect(
      windowsWithDecorationsFlag.document.getElementById("pake-top-dom"),
    ).not.toBeNull();
    expect(
      macWithDecorationsFlag.document.getElementById("pake-top-dom"),
    ).toBeNull();
    expect(
      macWithTitleBarFlag.document.getElementById("pake-top-dom"),
    ).not.toBeNull();
  });
});
