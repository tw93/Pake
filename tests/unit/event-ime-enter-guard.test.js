import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Oracle for the macOS WebKit Chinese-input-method Enter guard in
// src-tauri/src/inject/event.js. The script is loaded for real and its
// document capture-phase keydown listeners are dispatched in registration
// order, so these tests observe the same thing the page does: whether a
// keydown survives to the web app's own handler.
//
// Native capture on this machine (WKWebView + a Pinyin input method) shows the
// keydown that confirms a candidate arrives as
//   { key: "Enter", keyCode: 229, isComposing: false }
// after compositionend, while a plain Enter arrives as
//   { key: "Enter", keyCode: 13, isComposing: false }.
// A site that sends on `key === "Enter" && !isComposing` therefore cannot tell
// them apart; keyCode 229 is the only remaining signal that the input method
// consumed the key.

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
    id: "",
  };
}

function loadEventHelpers({
  userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
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
      platform: "MacIntel",
      language: "en-US",
      clipboard: { readText: () => Promise.resolve("") },
    },
    window: {
      history: { back: () => {}, forward: () => {} },
      location: {
        href: "https://example.com/app",
        origin: "https://example.com",
        pathname: "/app",
        reload: () => {},
      },
      localStorage: { getItem: () => null, setItem: () => {} },
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
      pakeConfig: {},
      __TAURI__: {
        core: { invoke: () => Promise.resolve() },
        window: {
          getCurrentWindow: () => ({
            startDragging: () => {},
            isFullscreen: () => Promise.resolve(false),
            setFullscreen: () => Promise.resolve(),
          }),
        },
      },
    },
    document: {
      addEventListener: registerListener,
      createElement: (tagName) => createElement(tagName),
      createRange: () => ({ selectNodeContents: vi.fn() }),
      getElementById: (id) => elementsById.get(id) || null,
      getElementsByTagName: () => [{ style: {} }],
      body,
      activeElement: body,
      execCommand: () => true,
    },
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);
  eventListeners.DOMContentLoaded.forEach(({ handler }) => handler());

  return { ...context, eventListeners };
}

function createKeyEvent(key, overrides = {}) {
  return {
    key,
    keyCode: 0,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isTrusted: true,
    repeat: false,
    target: { tagName: "DIV", isContentEditable: true },
    preventDefault: vi.fn(),
    stopPropagation: () => {},
    stopImmediatePropagation: vi.fn(),
    ...overrides,
  };
}

// Walks the document capture-phase listeners in registration order, then lets
// the web app's own keydown handler run only if propagation survived. This
// mirrors a site handler bound to a descendant of document, which is where
// message-composer send-on-Enter listeners live. stopPropagation stops the
// event from leaving the node, so the remaining document capture listeners
// still run, exactly like stopImmediatePropagation would not.
function dispatchToPage(context, event) {
  const pageHandler = vi.fn();
  let propagationStopped = false;
  let immediatePropagationStopped = false;
  event.stopPropagation = () => {
    propagationStopped = true;
  };
  event.stopImmediatePropagation = () => {
    immediatePropagationStopped = true;
    propagationStopped = true;
  };

  for (const { handler, options } of context.eventListeners.keydown || []) {
    if (options !== true) continue;
    handler(event);
    if (immediatePropagationStopped) break;
  }
  if (!propagationStopped) pageHandler(event);

  return { pageReceived: pageHandler.mock.calls.length > 0, event };
}

describe("event Chinese input method Enter guard", () => {
  it("keeps the candidate-confirming Enter (keyCode 229) away from the page", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("Enter", { keyCode: 229, isComposing: false });

    const { pageReceived } = dispatchToPage(context, event);

    expect(pageReceived).toBe(false);
  });

  it("does not cancel the input method commit for the confirming Enter", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("Enter", { keyCode: 229, isComposing: false });

    dispatchToPage(context, event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("still delivers a plain Enter (keyCode 13) so send-on-Enter keeps working", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("Enter", { keyCode: 13, isComposing: false });

    const { pageReceived } = dispatchToPage(context, event);

    expect(pageReceived).toBe(true);
  });

  it("lets other composing keys (keyCode 229) reach the page", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("a", { keyCode: 229, isComposing: true });

    const { pageReceived } = dispatchToPage(context, event);

    expect(pageReceived).toBe(true);
  });

  it("keeps the existing Process guard", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("Process", {
      keyCode: 0,
      isComposing: true,
    });

    const { pageReceived } = dispatchToPage(context, event);

    expect(pageReceived).toBe(false);
  });

  it("leaves the remaining document capture listeners running after the guard", () => {
    const context = loadEventHelpers();
    const event = createKeyEvent("Enter", { keyCode: 229, isComposing: false });
    const laterCaptureHandler = vi.fn();
    context.eventListeners.keydown.push({
      handler: laterCaptureHandler,
      options: true,
    });

    dispatchToPage(context, event);

    expect(laterCaptureHandler).toHaveBeenCalledTimes(1);
  });
});
