import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadEventHelpers({
  withTauri = false,
  userAgent = "Mozilla/5.0",
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/event.js"),
    "utf-8",
  );

  const invokeCalls = [];
  const clipboardText = "mocked clipboard text";
  const invoke = (command, payload) => {
    invokeCalls.push([command, payload]);
    if (command === "plugin:clipboard-manager|read_text") {
      return Promise.resolve(clipboardText);
    }
    return Promise.resolve();
  };
  const eventListeners = {};
  const elementsById = new Map();
  const registerListener = (type, handler, options) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push({ handler, options });
  };
  
  const execCommandCalls = [];
  const execCommand = (command, showUI, value) => {
    execCommandCalls.push([command, showUI, value]);
    return true;
  };

  const createElement = (tagName = "div") => {
    const el = {
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
      set id(value) {
        this._id = value;
        elementsById.set(value, this);
      },
      get id() {
        return this._id;
      },
    };
    return el;
  };

  const body = createElement("body");

  const activeElement = {
    tagName: "INPUT",
    isContentEditable: false,
    select: vi.fn(),
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
      activeElement,
      execCommand,
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
  return { ...context, eventListeners, invokeCalls, execCommandCalls, activeElement };
}

function runDomReady(context) {
  if (context.eventListeners.DOMContentLoaded) {
    context.eventListeners.DOMContentLoaded[0].handler();
  }
}

describe("event keyboard shortcuts bridge", () => {
  it("intercepts Ctrl+C/V/X/A on Windows/Linux", async () => {
    const context = loadEventHelpers({
      withTauri: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });
    runDomReady(context);

    const keydownListeners = context.eventListeners.keydown || [];
    // We expect our keydown listener to be registered on document
    const bridgeListener = keydownListeners.find(({ handler }) => {
      return handler.toString().includes("insertText") || handler.toString().includes("clipboard-manager");
    });

    expect(bridgeListener).toBeDefined();

    const { handler } = bridgeListener;

    // Test Ctrl+C
    const eventC = {
      key: "c",
      ctrlKey: true,
      preventDefault: vi.fn(),
    };
    handler(eventC);
    expect(context.execCommandCalls).toContainEqual(["copy", undefined, undefined]);
    expect(eventC.preventDefault).toHaveBeenCalled();

    // Test Ctrl+X
    const eventX = {
      key: "x",
      ctrlKey: true,
      preventDefault: vi.fn(),
    };
    handler(eventX);
    expect(context.execCommandCalls).toContainEqual(["cut", undefined, undefined]);
    expect(eventX.preventDefault).toHaveBeenCalled();

    // Test Ctrl+A
    const eventA = {
      key: "a",
      ctrlKey: true,
      preventDefault: vi.fn(),
    };
    handler(eventA);
    expect(context.activeElement.select).toHaveBeenCalled();
    expect(eventA.preventDefault).toHaveBeenCalled();

    // Test Ctrl+V
    const eventV = {
      key: "v",
      ctrlKey: true,
      preventDefault: vi.fn(),
    };
    handler(eventV);
    expect(eventV.preventDefault).toHaveBeenCalled();
    expect(context.invokeCalls).toContainEqual(["plugin:clipboard-manager|read_text", undefined]);

    // Let the promise resolve to check insertText execution
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(context.execCommandCalls).toContainEqual(["insertText", false, "mocked clipboard text"]);
  });

  it("does not intercept Ctrl+C/V/X/A on macOS", () => {
    const context = loadEventHelpers({
      withTauri: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    runDomReady(context);

    const keydownListeners = context.eventListeners.keydown || [];
    const bridgeListener = keydownListeners.find(({ handler }) => {
      return handler.toString().includes("insertText") || handler.toString().includes("clipboard-manager");
    });

    // On macOS, we should NOT define the keydown bridge listener
    expect(bridgeListener).toBeUndefined();
  });
});
