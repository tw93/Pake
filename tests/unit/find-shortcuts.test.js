import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function createElement(tagName) {
  const element = {
    tagName: tagName.toUpperCase(),
    id: "",
    type: "",
    textContent: "",
    style: {},
    children: [],
    attributes: new Map(),
    parentElement: null,
    parentNode: null,
    hidden: false,
    isContentEditable: false,
    appendChild(child) {
      child.parentElement = element;
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    append(...children) {
      children.forEach((child) => element.appendChild(child));
    },
    remove() {
      const siblings = element.parentElement?.children;
      if (siblings) siblings.splice(siblings.indexOf(element), 1);
      element.parentElement = null;
      element.parentNode = null;
    },
    addEventListener(type, handler) {
      element.listeners = element.listeners || {};
      element.listeners[type] = element.listeners[type] || [];
      element.listeners[type].push(handler);
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
      if (name === "id") element.id = String(value);
    },
    getAttribute(name) {
      return element.attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      element.attributes.delete(name);
    },
    toggleAttribute(name, force) {
      if (force) {
        element.setAttribute(name, "");
      } else {
        element.removeAttribute(name);
      }
    },
    closest(selector) {
      if (selector.startsWith("#")) {
        const id = selector.slice(1);
        for (let current = element; current; current = current.parentElement) {
          if (current.id === id) return current;
        }
      }
      return null;
    },
    replaceWith() {},
    scrollIntoView() {},
    normalize() {},
    focus() {},
    select() {},
  };
  return element;
}

function createTextNode(value, parent) {
  return {
    nodeType: 3,
    nodeValue: value,
    textContent: value,
    parentElement: parent,
    parentNode: parent,
  };
}

function createDocument(textNodes, notifyMutation = () => {}) {
  const listeners = {};
  const body = createElement("body");
  const head = createElement("head");

  const document = {
    body,
    head,
    documentElement: createElement("html"),
    listeners,
    addEventListener(type, handler, options) {
      listeners[type] = listeners[type] || [];
      listeners[type].push({ handler, options });
    },
    createElement,
    createTextNode(value) {
      return createTextNode(value, null);
    },
    createRange() {
      return {
        setStart(node, start) {
          this.startContainer = node;
          this.start = start;
        },
        setEnd(node, end) {
          this.endContainer = node;
          this.end = end;
        },
        surroundContents(mark) {
          mark.textContent = this.startContainer.nodeValue.slice(
            this.start,
            this.end,
          );
          notifyMutation({
            type: "childList",
            target: this.startContainer.parentNode,
          });
        },
      };
    },
    createTreeWalker(root, _whatToShow, filter) {
      const accepted = textNodes.filter(
        (node) => filter.acceptNode(node) === 1,
      );
      let index = -1;
      return {
        nextNode() {
          index += 1;
          return accepted[index] || null;
        },
      };
    },
    getElementById(id) {
      if (head.children.some((child) => child.id === id)) {
        return head.children.find((child) => child.id === id);
      }
      if (body.children.some((child) => child.id === id)) {
        return body.children.find((child) => child.id === id);
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    adoptedStyleSheets: [],
  };

  return document;
}

function createKeyboardEvent(key, overrides = {}) {
  const event = {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...overrides,
  };
  return event;
}

function loadFindScript({
  enabled = true,
  userAgent = "Mozilla/5.0",
  nodes = [],
  observeMutations = false,
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/find.js"),
    "utf-8",
  );
  const styleSource = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/styles.js"),
    "utf-8",
  );
  const observers = new Set();
  const notifyMutation = (record) => {
    for (const observer of observers) {
      observer.records.push(record);
      queueMicrotask(() => {
        if (observer.records.length) {
          observer.callback(observer.records.splice(0));
        }
      });
    }
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => callback(),
    navigator: { userAgent },
    NodeFilter: {
      SHOW_TEXT: 4,
      FILTER_ACCEPT: 1,
      FILTER_REJECT: 2,
    },
    window: {
      listeners: {},
      addEventListener(type, handler, options) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push({ handler, options });
      },
      pakeConfig: { enable_find: enabled },
      CSSStyleSheet: class CSSStyleSheet {
        replaceSync(css) {
          this.cssText = css;
        }
      },
    },
    document: createDocument(nodes, notifyMutation),
  };
  if (observeMutations) {
    context.MutationObserver = class {
      constructor(callback) {
        this.callback = callback;
        this.records = [];
      }
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
        this.records = [];
      }
    };
  }
  context.window.NodeFilter = context.NodeFilter;
  context.window.navigator = context.navigator;

  runInNewContext(styleSource, context);
  runInNewContext(source, context);
  return { ...context, notifyMutation };
}

describe("Find injection", () => {
  it("does not register shortcuts when enable_find is false", () => {
    const paragraph = createElement("p");
    const context = loadFindScript({
      enabled: false,
      nodes: [createTextNode("Alpha alpha", paragraph)],
    });

    expect(context.window.listeners.keydown).toBeUndefined();
    expect(context.window.pakeFind.getState().enabled).toBe(false);
    expect(
      context.window.pakeFind.getFindShortcutAction(
        createKeyboardEvent("f", { ctrlKey: true }),
      ),
    ).toBe("");
    expect(context.window.pakeFind.open().isOpen).toBe(false);
    expect(context.window.pakeFind.search("alpha").matchCount).toBe(0);
    expect(context.window.pakeFind.next().activeIndex).toBe(-1);
    expect(context.window.pakeFind.previous().activeIndex).toBe(-1);
    expect(context.window.pakeFind.close().matchCount).toBe(0);
    expect(context.document.head.children).toHaveLength(0);
    expect(context.document.body.children).toHaveLength(0);
  });

  it("handles Cmd/Ctrl+F and Cmd/Ctrl+G shortcuts when enabled", () => {
    const context = loadFindScript({ enabled: true });
    const calls = [];
    context.window.pakeFind.open = () => calls.push("open");
    context.window.pakeFind.next = () => calls.push("next");
    context.window.pakeFind.previous = () => calls.push("previous");

    const [listener] = context.window.listeners.keydown;

    const findEvent = createKeyboardEvent("f", { ctrlKey: true });
    listener.handler(findEvent);
    const nextEvent = createKeyboardEvent("g", { ctrlKey: true });
    listener.handler(nextEvent);
    const previousEvent = createKeyboardEvent("g", {
      ctrlKey: true,
      shiftKey: true,
    });
    listener.handler(previousEvent);

    expect(calls).toEqual(["open", "next", "previous"]);
    expect(findEvent.defaultPrevented).toBe(true);
    expect(previousEvent.propagationStopped).toBeFalsy();
  });

  it("lets a page with its own find keep the shortcut", () => {
    const context = loadFindScript({ enabled: true });
    const calls = [];
    context.window.pakeFind.open = () => calls.push("open");

    const [listener] = context.window.listeners.keydown;
    expect(listener.options).toBeUndefined();

    const handled = createKeyboardEvent("f", { ctrlKey: true });
    handled.preventDefault();
    listener.handler(handled);

    expect(calls).toEqual([]);
  });

  it("uses the shared style injector for the find panel", () => {
    const context = loadFindScript({ enabled: true });

    expect(context.window.pakeFind.open().isOpen).toBe(true);
    expect(context.document.adoptedStyleSheets).toHaveLength(1);
    expect(context.document.head.children).toHaveLength(0);
  });

  it("leaves macOS Find shortcuts to the native menu", () => {
    const context = loadFindScript({
      enabled: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    const calls = [];
    context.window.pakeFind.open = () => calls.push("open");

    const [listener] = context.window.listeners.keydown;
    listener.handler(createKeyboardEvent("f", { ctrlKey: true }));
    listener.handler(createKeyboardEvent("f", { metaKey: true }));

    expect(calls).toEqual([]);
  });

  it("counts text matches and skips input and script content", () => {
    const paragraph = createElement("p");
    const script = createElement("script");
    const input = createElement("input");
    const nodes = [
      createTextNode("Alpha beta alpha", paragraph),
      createTextNode("alpha", script),
      createTextNode("alpha", input),
    ];
    const context = loadFindScript({ enabled: true, nodes });

    const result = context.window.pakeFind.search("alpha");

    expect(result.matchCount).toBe(2);
    expect(result.activeIndex).toBe(0);
  });

  it("clears matches on Escape", () => {
    const paragraph = createElement("p");
    const context = loadFindScript({
      enabled: true,
      nodes: [createTextNode("Alpha alpha", paragraph)],
    });

    context.window.pakeFind.search("alpha");
    expect(context.window.pakeFind.getState().matchCount).toBe(2);

    context.window.pakeFind.close();
    expect(context.window.pakeFind.getState().matchCount).toBe(0);
  });

  it("ignores its own DOM highlights but searches real changes and stops on close", async () => {
    vi.useFakeTimers();
    try {
      const paragraph = createElement("p");
      const node = createTextNode("Alpha alpha", paragraph);
      const context = loadFindScript({ nodes: [node], observeMutations: true });
      const walk = vi.spyOn(context.document, "createTreeWalker");
      const find = context.window.pakeFind;
      find.open();
      find.search("alpha");
      await vi.advanceTimersByTimeAsync(650);
      expect(walk).toHaveBeenCalledTimes(1);
      expect(find.getState().matchCount).toBe(2);

      node.nodeValue = "Alpha alpha alpha";
      context.notifyMutation({ type: "characterData", target: node });
      await vi.advanceTimersByTimeAsync(650);
      expect(walk).toHaveBeenCalledTimes(2);
      expect(find.getState().matchCount).toBe(3);

      node.nodeValue = "Alpha alpha alpha alpha";
      context.notifyMutation({ type: "characterData", target: node });
      find.search("alpha");
      await vi.advanceTimersByTimeAsync(650);
      expect(walk).toHaveBeenCalledTimes(3);
      expect(find.getState().matchCount).toBe(4);

      context.notifyMutation({ type: "characterData", target: node });
      await Promise.resolve();
      find.close();
      node.nodeValue = "Alpha";
      context.notifyMutation({ type: "characterData", target: node });
      await vi.advanceTimersByTimeAsync(650);
      expect(walk).toHaveBeenCalledTimes(3);
      expect(find.getState().isOpen).toBe(false);
      expect(find.getState().matchCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
