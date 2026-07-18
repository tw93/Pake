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
  activeElement = createElement("body"),
  selectionText = "",
  clipboardText = "clipboard text",
  clipboardReadRejects = false,
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/event.js"),
    "utf-8",
  );

  const eventListeners = {};
  const elementsById = new Map();
  const execCommandCalls = [];
  const invokeCalls = [];
  const clipboardReadCalls = [];
  const body = createElement("body");
  body.scrollHeight = 0;
  body.appendChild = (child) => {
    body.children.push(child);
    if (child.id) elementsById.set(child.id, child);
    return child;
  };
  body.removeChild = (child) => {
    body.children = body.children.filter((item) => item !== child);
    if (child.id) elementsById.delete(child.id);
  };

  const registerListener = (type, handler, options) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push({ handler, options });
  };

  const context = {
    console,
    URL,
    // Main-realm Date so tests can shift time seen by the fallback TTL.
    Date,
    Event: class {},
    Notification: function Notification() {},
    setTimeout,
    clearTimeout,
    scrollTo: () => {},
    navigator: {
      userAgent,
      language: "en-US",
      clipboard: {
        readText: () => {
          clipboardReadCalls.push([]);
          if (clipboardReadRejects) {
            return Promise.reject(new Error("clipboard denied"));
          }
          return Promise.resolve(clipboardText);
        },
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
        toString: () => selectionText,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      }),
      open: () => ({}),
      isAuthLink: () => false,
      isAuthPopup: () => false,
      pakeConfig: {},
      __TAURI__: {
        core: {
          invoke: (command, payload) => {
            invokeCalls.push([command, payload]);
            return Promise.resolve();
          },
        },
        window: {
          getCurrentWindow: () => ({
            startDragging: () => {},
            isFullscreen: () => Promise.resolve(false),
            setFullscreen: () => {},
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
      activeElement,
      execCommand: (command, showUI, value) => {
        execCommandCalls.push([command, showUI, value]);
        return true;
      },
    },
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);
  eventListeners.DOMContentLoaded[0].handler();

  return {
    ...context,
    // Live contextified global: assigning properties here reaches the vm.
    sandbox: context,
    eventListeners,
    execCommandCalls,
    invokeCalls,
    clipboardReadCalls,
  };
}

function getClipboardShortcutHandler(context) {
  return context.eventListeners.keydown.find(
    ({ handler }) => handler.name === "handleClipboardShortcut",
  ).handler;
}

function getClipboardPasteFallbackHandler(context) {
  return context.eventListeners.keyup.find(
    ({ handler }) => handler.name === "handleClipboardPasteFallback",
  ).handler;
}

function getPasteHandler(context) {
  return context.eventListeners.paste.find(
    ({ handler }) => handler.name === "handlePaste",
  ).handler;
}

function createKeyEvent(key, overrides = {}) {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isTrusted: true,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe("event clipboard shortcuts", () => {
  it("copies selected page text on Windows and Linux without Tauri clipboard IPC", () => {
    const context = loadEventHelpers({ selectionText: "selected text" });
    const handler = getClipboardShortcutHandler(context);
    const event = createKeyEvent("c");

    handler(event);

    expect(context.execCommandCalls).toEqual([["copy", undefined, undefined]]);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(context.invokeCalls).toEqual([]);
  });

  it("cuts and selects editable text", () => {
    const input = createElement("input");
    input.select = vi.fn();
    const context = loadEventHelpers({ activeElement: input });
    const handler = getClipboardShortcutHandler(context);
    const cutEvent = createKeyEvent("x");
    const selectAllEvent = createKeyEvent("a");

    handler(cutEvent);
    handler(selectAllEvent);

    expect(context.execCommandCalls).toEqual([["cut", undefined, undefined]]);
    expect(input.select).toHaveBeenCalled();
    expect(cutEvent.preventDefault).toHaveBeenCalled();
    expect(selectAllEvent.preventDefault).toHaveBeenCalled();
  });

  it("lets native paste preserve non-text clipboard data", async () => {
    const editor = createElement("div");
    editor.isContentEditable = true;
    const context = loadEventHelpers({ activeElement: editor });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);
    const pasteHandler = getPasteHandler(context);
    const keydownEvent = createKeyEvent("v");
    const nativePasteEvent = {
      clipboardData: {
        types: ["Files", "image/png"],
        getData: () => "",
      },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    shortcutHandler(keydownEvent);
    pasteHandler(nativePasteEvent);
    fallbackHandler(createKeyEvent("v"));
    await Promise.resolve();

    expect(keydownEvent.preventDefault).not.toHaveBeenCalled();
    expect(nativePasteEvent.preventDefault).not.toHaveBeenCalled();
    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
  });

  it("keeps paste and match style text-only behavior", () => {
    const input = createElement("input");
    const context = loadEventHelpers({ activeElement: input });
    const pasteHandler = getPasteHandler(context);
    const pasteEvent = {
      clipboardData: { getData: () => "plain text" },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    context.triggerPasteAsPlainText();
    pasteHandler(pasteEvent);

    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    expect(pasteEvent.stopImmediatePropagation).toHaveBeenCalled();
    expect(context.execCommandCalls).toEqual([
      ["paste", undefined, undefined],
      ["insertText", false, "plain text"],
    ]);
  });

  it("falls back to clipboard text only when native paste does not fire", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({
      activeElement: input,
      clipboardText: "pasted text",
    });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);
    const keydownEvent = createKeyEvent("v");

    shortcutHandler(keydownEvent);
    expect(keydownEvent.preventDefault).not.toHaveBeenCalled();
    expect(context.clipboardReadCalls).toEqual([]);

    fallbackHandler(createKeyEvent("v"));
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([[]]);
    expect(context.execCommandCalls).toEqual([
      ["insertText", false, "pasted text"],
    ]);
    expect(context.invokeCalls).toEqual([]);
  });

  it("does not re-arm the fallback from key-repeat after native paste fired", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({ activeElement: input });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);
    const pasteHandler = getPasteHandler(context);
    const nativePasteEvent = {
      clipboardData: { types: ["image/png"], getData: () => "" },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    shortcutHandler(createKeyEvent("v"));
    pasteHandler(nativePasteEvent);
    // Held key: repeated keydown events arrive after the native paste.
    shortcutHandler(createKeyEvent("v", { repeat: true }));
    shortcutHandler(createKeyEvent("v", { repeat: true }));
    fallbackHandler(createKeyEvent("v"));
    await Promise.resolve();

    // The image already pasted natively; keyup must not paste text on top.
    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
  });

  it("expires a stale armed fallback instead of pasting on a later keyup", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({ activeElement: input });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);

    shortcutHandler(createKeyEvent("v"));
    // Keyup was lost (focus left mid-press); much later a plain "v" keyup
    // arrives on the same element.
    const realNow = Date.now();
    context.sandbox.Date = { now: () => realNow + 10_000 };
    fallbackHandler(createKeyEvent("v"));
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
  });

  it("does not read clipboard for synthetic paste shortcuts", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({ activeElement: input });
    const handler = getClipboardShortcutHandler(context);
    const pasteEvent = createKeyEvent("v", { isTrusted: false });

    handler(pasteEvent);
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
    expect(pasteEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("does not run a pending paste fallback from a synthetic keyup", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({ activeElement: input });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);

    shortcutHandler(createKeyEvent("v"));
    fallbackHandler(createKeyEvent("v", { isTrusted: false }));
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
  });

  it("does not read clipboard for non-text input elements", async () => {
    const checkbox = createElement("input");
    checkbox.type = "checkbox";
    const context = loadEventHelpers({ activeElement: checkbox });
    const handler = getClipboardShortcutHandler(context);
    const pasteEvent = createKeyEvent("v");

    handler(pasteEvent);
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([]);
    expect(pasteEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("does not add Tauri fallback when async clipboard read is denied", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({
      activeElement: input,
      clipboardReadRejects: true,
    });
    const shortcutHandler = getClipboardShortcutHandler(context);
    const fallbackHandler = getClipboardPasteFallbackHandler(context);
    const keydownEvent = createKeyEvent("v");

    shortcutHandler(keydownEvent);
    fallbackHandler(createKeyEvent("v"));
    await Promise.resolve();
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([[]]);
    expect(context.execCommandCalls).toEqual([]);
    expect(keydownEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("leaves non-editable paste and macOS shortcuts untouched", () => {
    const windowsContext = loadEventHelpers();
    const windowsHandler = getClipboardShortcutHandler(windowsContext);
    const pasteEvent = createKeyEvent("v");

    windowsHandler(pasteEvent);

    const macContext = loadEventHelpers({
      selectionText: "selected text",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    const macHandler = getClipboardShortcutHandler(macContext);
    const copyEvent = createKeyEvent("c", { metaKey: true, ctrlKey: false });

    macHandler(copyEvent);

    expect(pasteEvent.preventDefault).not.toHaveBeenCalled();
    expect(copyEvent.preventDefault).not.toHaveBeenCalled();
    expect(windowsContext.clipboardReadCalls).toEqual([]);
    expect(windowsContext.execCommandCalls).toEqual([]);
    expect(macContext.execCommandCalls).toEqual([]);
  });

  it("does not intercept copy when there is no editable target or selected text", () => {
    const context = loadEventHelpers();
    const handler = getClipboardShortcutHandler(context);
    const event = createKeyEvent("c");

    handler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(context.execCommandCalls).toEqual([]);
  });
});
