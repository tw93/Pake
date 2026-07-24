// Unit tests for the YouTube Music adblock injection.
// For a manual outside-Pake test, open tests/fixtures/youtubemusic-adblock.html
// in a browser and verify that all red ad boxes are hidden.

import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SCRIPT_PATH = path.join(process.cwd(), "injects/youtubemusic-adblock.js");

function createElement(tagName = "div", overrides = {}) {
  const element = {
    tagName: tagName.toUpperCase(),
    style: {},
    attributes: {},
    children: [],
    hidden: false,
    offsetParent: null,
    clickCount: 0,
    textContent: "",
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    click() {
      this.clickCount += 1;
    },
    get subheader() {
      return this.attributes.subheader ?? "";
    },
    set subheader(value) {
      this.attributes.subheader = String(value);
    },
    ...overrides,
  };
  return element;
}

function loadAdblock({
  readyState = "loading",
  elements = [],
  fetchImpl = null,
} = {}) {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");
  const eventListeners = {};
  const intervalCallbacks = [];
  const elementsBySelector = new Map();

  const registerListener = (type, handler) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(handler);
  };

  function querySelectorAll(selector) {
    const matches = [];
    const roots = elements.length > 0 ? elements : [document.body];
    function walk(el) {
      if (!el) return;
      if (elementMatches(el, selector)) matches.push(el);
      (el.children || []).forEach(walk);
    }
    roots.forEach(walk);
    return matches;
  }

  function querySelector(selector) {
    return querySelectorAll(selector)[0] || null;
  }

  function elementMatches(el, selector) {
    if (!el || !el.tagName) return false;
    const lowerTag = el.tagName.toLowerCase();
    const classNames = (el.attributes.class || "").split(/\s+/).filter(Boolean);

    // Tag selector.
    if (selector === lowerTag) return true;
    // Class selector.
    if (selector.startsWith(".") && classNames.includes(selector.slice(1)))
      return true;
    // ID selector.
    if (selector.startsWith("#") && el.attributes.id === selector.slice(1))
      return true;
    // Attribute contains selector, e.g. [subheader*="Ad"].
    const attrContainsMatch = selector.match(/^\[([^*\]]+)\*="([^"]+)"\]$/);
    if (attrContainsMatch) {
      const [, attr, needle] = attrContainsMatch;
      const value = el.attributes[attr] || "";
      return value.toLowerCase().includes(needle.toLowerCase());
    }
    // Tag + attribute contains, e.g. ytmusic-shelf-renderer[subheader*="Ad"].
    const tagAttrMatch = selector.match(
      /^([a-z0-9-]+)\[([^*\]]+)\*="([^"]+)"\]$/i,
    );
    if (tagAttrMatch) {
      const [, tag, attr, needle] = tagAttrMatch;
      if (lowerTag !== tag.toLowerCase()) return false;
      const value = el.attributes[attr] || "";
      return value.toLowerCase().includes(needle.toLowerCase());
    }
    return false;
  }

  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.statusText = init.statusText ?? "OK";
      this.headers = init.headers || new Map();
    }
    clone() {
      return new MockResponse(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers,
      });
    }
    async text() {
      return this.body;
    }
  }

  class MockXMLHttpRequest {
    constructor() {
      this._listeners = {};
      this.readyState = 0;
      this.responseType = "";
      this._responseText = "";
      this._pakeUrl = "";
    }
    open(method, url) {
      this._pakeUrl = url;
    }
    send() {}
    addEventListener(type, handler) {
      this._listeners[type] = this._listeners[type] || [];
      this._listeners[type].push(handler);
    }
    set responseText(value) {
      this._responseText = value;
    }
    get responseText() {
      return this._responseText;
    }
    get response() {
      return this._responseText;
    }
    triggerLoad(responseText) {
      this.readyState = 4;
      this._responseText = responseText;
      (this._listeners.readystatechange || []).forEach((h) => h());
      (this._listeners.load || []).forEach((h) => h());
    }
  }

  const MutationObserver = vi.fn(function MutationObserver(callback) {
    this.observe = () => {};
    this.disconnect = () => {};
    this._callback = callback;
  });

  const document = {
    readyState,
    body: createElement("body"),
    addEventListener: registerListener,
    removeEventListener: () => {},
    querySelector,
    querySelectorAll,
    createElement: (tagName) => createElement(tagName),
  };

  const window = {
    fetch: fetchImpl,
    XMLHttpRequest: MockXMLHttpRequest,
    addEventListener: () => {},
    removeEventListener: () => {},
    MutationObserver,
  };

  const context = {
    console,
    window,
    document,
    navigator: { userAgent: "test" },
    setTimeout: (fn, delay) => fn(),
    setInterval: (fn) => {
      intervalCallbacks.push(fn);
      return intervalCallbacks.length;
    },
    clearInterval: () => {},
    MutationObserver,
    Response: MockResponse,
    XMLHttpRequest: MockXMLHttpRequest,
    Object,
    JSON,
    RegExp,
    Error,
    Map,
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);

  if (readyState === "loading") {
    const handlers = eventListeners.DOMContentLoaded || [];
    handlers.forEach((handler) => handler());
  }

  return {
    context,
    document,
    window,
    MutationObserver,
    intervalCallbacks,
    MockXMLHttpRequest,
    triggerInterval: () => intervalCallbacks.forEach((fn) => fn()),
  };
}

describe("youtubemusic-adblock", () => {
  it("hides known YouTube Music ad elements on init", () => {
    const adSlot = createElement("ytmusic-ad-slot-renderer", {
      attributes: { class: "ytmusic-ad-slot-renderer" },
    });
    const playerBarAd = createElement("ytmusic-player-bar-ad-slot");
    const normal = createElement("ytmusic-player");

    const { document } = loadAdblock({
      elements: [adSlot, playerBarAd, normal],
    });

    expect(adSlot.style.display).toBe("none");
    expect(adSlot.hasAttribute("hidden")).toBe(true);
    expect(playerBarAd.style.display).toBe("none");
    expect(normal.style.display).toBeUndefined();
  });

  it("hides ad elements added after init via the mutation observer", () => {
    const adSlot = createElement("ytmusic-ad-slot-renderer");
    const { document, MutationObserver } = loadAdblock({
      elements: [],
    });

    expect(MutationObserver).toHaveBeenCalled();
    document.body.appendChild(adSlot);
    MutationObserver.mock.results[0].value._callback([
      { addedNodes: [adSlot] },
    ]);

    expect(adSlot.style.display).toBe("none");
  });

  it("clicks visible skip buttons on interval", () => {
    const skipButton = createElement("button", {
      attributes: { class: "ytp-ad-skip-button-modern" },
      offsetParent: {},
    });

    const { triggerInterval } = loadAdblock({
      elements: [skipButton],
    });

    triggerInterval();
    expect(skipButton.clickCount).toBe(1);
  });

  it("strips ad keys from ytInitialPlayerResponse when assigned", () => {
    const { context } = loadAdblock();

    context.window.ytInitialPlayerResponse = {
      videoDetails: { videoId: "abc" },
      adPlacements: [{ ad: 1 }],
      playerAds: [{ ad: 2 }],
      adSlots: [{ ad: 3 }],
    };

    expect(context.window.ytInitialPlayerResponse.adPlacements).toBeUndefined();
    expect(context.window.ytInitialPlayerResponse.playerAds).toBeUndefined();
    expect(context.window.ytInitialPlayerResponse.adSlots).toBeUndefined();
    expect(context.window.ytInitialPlayerResponse.videoDetails.videoId).toBe(
      "abc",
    );
  });

  it("replaces ad keys in fetch responses for music.youtube.com", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new context.Response(
          '{"adPlacements":[{"ad":1}],"playerAds":[{"ad":2}],"videoDetails":{"id":"x"}}',
          { status: 200 },
        ),
      ),
    );

    const context = loadAdblock({ fetchImpl }).context;
    const response = await context.window.fetch(
      "https://music.youtube.com/youtubei/v1/player",
    );
    const text = await response.text();

    expect(text).not.toContain('"adPlacements"');
    expect(text).not.toContain('"playerAds"');
    expect(text).toContain('"videoDetails"');
  });

  it("replaces ad keys in XMLHttpRequest responses for youtubei endpoints", () => {
    const { context, MockXMLHttpRequest } = loadAdblock();
    const xhr = new context.window.XMLHttpRequest();
    xhr.open("POST", "https://www.youtube.com/youtubei/v1/next?key=abc");
    xhr.send();
    xhr.triggerLoad('{"adSlots":[{"ad":1}],"contents":{}}');

    expect(xhr.responseText).not.toContain('"adSlots"');
    expect(xhr.responseText).toContain('"contents"');
  });

  it("does not modify non-YouTube requests", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new context.Response('{"adPlacements":[{"ad":1}]}', { status: 200 }),
      ),
    );

    const context = loadAdblock({ fetchImpl }).context;
    const response = await context.window.fetch("https://example.com/api");
    const text = await response.text();

    expect(text).toContain('"adPlacements"');
  });
});
