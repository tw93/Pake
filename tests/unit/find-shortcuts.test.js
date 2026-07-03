import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

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

function createDocument(textNodes) {
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
} = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/find.js"),
    "utf-8",
  );
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
      pakeConfig: { enable_find: enabled },
    },
    document: createDocument(nodes),
  };
  context.window.NodeFilter = context.NodeFilter;
  context.window.navigator = context.navigator;

  runInNewContext(source, context);
  return context;
}

describe("Find injection", () => {
  it("does not register shortcuts when enable_find is false", () => {
    const paragraph = createElement("p");
    const context = loadFindScript({
      enabled: false,
      nodes: [createTextNode("Alpha alpha", paragraph)],
    });

    expect(context.document.listeners.keydown).toBeUndefined();
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

    const [listener] = context.document.listeners.keydown;

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
    expect(previousEvent.propagationStopped).toBe(true);
  });

  it("uses the macOS modifier for Find shortcuts", () => {
    const context = loadFindScript({
      enabled: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    const calls = [];
    context.window.pakeFind.open = () => calls.push("open");

    const [listener] = context.document.listeners.keydown;
    listener.handler(createKeyboardEvent("f", { ctrlKey: true }));
    listener.handler(createKeyboardEvent("f", { metaKey: true }));

    expect(calls).toEqual(["open"]);
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
});
