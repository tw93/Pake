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
  const source = ["link_policy.js", "event.js"]
    .map((file) =>
      fs.readFileSync(
        path.join(process.cwd(), "src-tauri/src/inject", file),
        "utf-8",
      ),
    )
    .join("\n");

  const eventListeners = {};
  const elementsById = new Map();
  const fullscreenCalls = [];
  const reloadCalls = [];
  const navigateCalls = [];
  const invokeCalls = [];
  const closeCalls = [];
  const clipboardWrites = [];
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
    Event,
    EventTarget,
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
        reload: () => reloadCalls.push(true),
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
          invoke: (command, payload) => {
            invokeCalls.push(command);
            if (command === "webview_navigate") {
              navigateCalls.push(payload?.action);
            }
            return Promise.resolve();
          },
        },
        window: {
          getCurrentWindow: () => ({
            startDragging: () => {},
            close: () => closeCalls.push("close"),
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
    reloadCalls,
    navigateCalls,
    invokeCalls,
    closeCalls,
    clipboardWrites,
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

function getWindowShortcutHandler(context) {
  return context.eventListeners.keydown.find(
    ({ handler }) => handler.name === "handleWindowShortcut",
  ).handler;
}

function getWebShortcutHandler(context) {
  return context.eventListeners.keyup.find(
    ({ handler }) => handler.name === "handleWebShortcut",
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
  it("preserves WebView2 native fullscreen and keeps the other platform polyfill", () => {
    const source = fs.readFileSync("src-tauri/src/app/window.rs", "utf8");
    const injection =
      /#\[cfg\(not\(target_os = "windows"\)\)\]\s*\{\s*window_builder =\s*window_builder\.initialization_script\(include_str!\("\.\.\/inject\/fullscreen\.js"\)\);\s*\}/;
    expect(source).toMatch(injection);
    expect(
      source.match(/include_str!\("\.\.\/inject\/fullscreen\.js"\)/g),
    ).toHaveLength(1);
  });

  it("leaves macOS reload shortcuts to the native menu", () => {
    const context = loadEventHelpers({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
    });
    const event = createKeyEvent("r", { metaKey: true });

    getWebShortcutHandler(context)(event);

    expect(context.reloadCalls).toEqual([]);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("keeps Ctrl+R web shortcuts on Windows and Linux", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("r", { ctrlKey: true });

    getWebShortcutHandler(context)(event);

    // Native webview_navigate so blank error pages still reload.
    expect(context.navigateCalls).toEqual(["reload"]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("closes, quits and copies the address on Windows and Linux as the macOS menu does", () => {
    const context = loadEventHelpers();
    context.navigator.clipboard = {
      writeText: (text) => {
        context.clipboardWrites.push(text);
        return Promise.resolve();
      },
    };
    context.window.location = { href: "https://example.com/page" };
    const handler = getWindowShortcutHandler(context);

    handler(createKeyEvent("w", { ctrlKey: true }));
    expect(context.closeCalls).toEqual(["close"]);

    handler(createKeyEvent("q", { ctrlKey: true }));
    expect(context.invokeCalls).toContain("quit_app");

    handler(createKeyEvent("L", { ctrlKey: true }));
    expect(context.clipboardWrites).toEqual(["https://example.com/page"]);

    // Ctrl+Shift+W and friends belong to the page.
    handler(createKeyEvent("w", { ctrlKey: true, shiftKey: true }));
    expect(context.closeCalls).toEqual(["close"]);
  });

  it("goes back and forward on Alt+Left and Alt+Right on Windows and Linux", () => {
    const context = loadEventHelpers();
    const handler = getWindowShortcutHandler(context);

    handler(createKeyEvent("ArrowLeft", { altKey: true }));
    handler(createKeyEvent("ArrowRight", { altKey: true }));
    handler(createKeyEvent("ArrowLeft", { altKey: true, shiftKey: true }));

    expect(context.navigateCalls).toEqual(["back", "forward"]);
  });

  it("leaves the window shortcuts to the macOS menu", () => {
    const context = loadEventHelpers({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
    });
    const handler = getWindowShortcutHandler(context);

    handler(createKeyEvent("w", { ctrlKey: true }));
    handler(createKeyEvent("ArrowLeft", { altKey: true }));

    expect(context.closeCalls).toEqual([]);
    expect(context.navigateCalls).toEqual([]);
  });

  it("leaves a window shortcut to a page that handled the key itself", () => {
    const context = loadEventHelpers();
    const handler = getWindowShortcutHandler(context);

    // A web terminal takes Ctrl+W on keydown and prevents the default.
    handler(createKeyEvent("w", { ctrlKey: true, defaultPrevented: true }));
    handler(
      createKeyEvent("ArrowLeft", { altKey: true, defaultPrevented: true }),
    );
    handler(createKeyEvent("w", { ctrlKey: true, repeat: true }));
    // AltGr on European layouts reports Ctrl and Alt together.
    handler(createKeyEvent("q", { ctrlKey: true, altKey: true }));

    expect(context.closeCalls).toEqual([]);
    expect(context.navigateCalls).toEqual([]);
    expect(context.invokeCalls).not.toContain("quit_app");
  });

  it("keeps macOS scroll-to-edge shortcuts in the webview", () => {
    const context = loadEventHelpers({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
    });
    const event = createKeyEvent("ArrowUp", { metaKey: true });

    getWebShortcutHandler(context)(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

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

  it("exits DOM fullscreen before leaving a fullscreen video on F11", async () => {
    const context = loadEventHelpers({ initialFullscreen: true });
    context.document.fullscreenElement = context.document.body;
    context.document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    getFullscreenShortcutHandler(context)(createKeyEvent("F11"));
    await Promise.resolve();
    await Promise.resolve();
    expect(context.document.exitFullscreen).toHaveBeenCalledOnce();
    expect(context.fullscreenCalls).toEqual([]);
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
