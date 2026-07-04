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
  pasteCommandSucceeds = false,
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
        if (command === "paste") {
          return pasteCommandSucceeds;
        }
        return true;
      },
    },
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);
  eventListeners.DOMContentLoaded[0].handler();

  return {
    ...context,
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

  it("pastes clipboard text into editable elements without Tauri clipboard IPC", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({
      activeElement: input,
      clipboardText: "pasted text",
    });
    const handler = getClipboardShortcutHandler(context);
    const pasteEvent = createKeyEvent("v");

    handler(pasteEvent);
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([[]]);
    expect(context.execCommandCalls).toEqual([
      ["paste", undefined, undefined],
      ["insertText", false, "pasted text"],
    ]);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    expect(context.invokeCalls).toEqual([]);
  });

  it("uses the browser paste command first when available", async () => {
    const input = createElement("input");
    const context = loadEventHelpers({
      activeElement: input,
      pasteCommandSucceeds: true,
    });
    const handler = getClipboardShortcutHandler(context);
    const pasteEvent = createKeyEvent("v");

    handler(pasteEvent);
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([]);
    expect(context.execCommandCalls).toEqual([["paste", undefined, undefined]]);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
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
    const handler = getClipboardShortcutHandler(context);
    const pasteEvent = createKeyEvent("v");

    handler(pasteEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(context.clipboardReadCalls).toEqual([[]]);
    expect(context.execCommandCalls).toEqual([["paste", undefined, undefined]]);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
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
