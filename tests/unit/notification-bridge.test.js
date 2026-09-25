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
  };
}

function loadNotificationBridge({
  nativeClick = false,
  hasFocus = false,
} = {}) {
  const source = ["link_policy.js", "event.js"]
    .map((file) =>
      fs.readFileSync(
        path.join(process.cwd(), "src-tauri/src/inject", file),
        "utf-8",
      ),
    )
    .join("\n");

  const windowListeners = {};
  const documentListeners = {};
  const invokeCalls = [];
  const body = createElement("body");

  const context = {
    console,
    URL,
    Event,
    EventTarget,
    setTimeout,
    clearTimeout,
    scrollTo: () => {},
    navigator: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      language: "en-US",
      clipboard: { readText: () => Promise.resolve("") },
    },
    window: {
      history: { back: () => {}, forward: () => {} },
      location: {
        href: "https://app.slack.com/client",
        origin: "https://app.slack.com",
        pathname: "/client",
        reload: () => {},
      },
      localStorage: { getItem: () => null, setItem: () => {} },
      addEventListener: (type, handler) => {
        (windowListeners[type] = windowListeners[type] || []).push(handler);
      },
      dispatchEvent: () => {},
      getSelection: () => ({ toString: () => "" }),
      open: () => ({}),
      isAuthLink: () => false,
      isAuthPopup: () => false,
      pakeConfig: {},
      __TAURI__: {
        core: {
          invoke: (command, payload) => {
            invokeCalls.push({ command, payload });
            if (command === "send_notification") {
              return Promise.resolve({ nativeClick });
            }
            return Promise.resolve();
          },
        },
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
      addEventListener: (type, handler) => {
        (documentListeners[type] = documentListeners[type] || []).push(handler);
      },
      hasFocus: () => hasFocus,
      createElement: (tagName) => createElement(tagName),
      createRange: () => ({ selectNodeContents: vi.fn() }),
      getElementById: () => null,
      getElementsByTagName: () => [{ style: {} }],
      body,
      activeElement: body,
      execCommand: () => true,
    },
  };
  context.window.navigator = context.navigator;

  runInNewContext(source, context);

  const fire = (listeners, type, event) => {
    for (const handler of listeners[type] || []) handler(event);
  };

  return {
    Notification: context.window.Notification,
    notificationClick: context.window.__pakeNotificationClick,
    invokeCalls,
    focusWindow: () => fire(windowListeners, "focus", new Event("focus")),
    clickInPage: () => fire(documentListeners, "click", new Event("click")),
    // Drain the invoke promise chain that records the fallback state.
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

describe("notification bridge", () => {
  it("routes an addEventListener click handler with the notification as target", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    const notif = new bridge.Notification("Ann", { body: "hi" });
    await bridge.settle();

    const handler = vi.fn();
    notif.addEventListener("click", handler);

    const { id } = bridge.invokeCalls[0].payload.params;
    bridge.notificationClick(id);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].target).toBe(notif);
  });

  it("supports the onclick property and reassignment", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    const notif = new bridge.Notification("Ann");
    await bridge.settle();

    const first = vi.fn();
    const second = vi.fn();
    notif.onclick = first;
    expect(notif.onclick).toBe(first);
    notif.onclick = second;

    bridge.notificationClick(bridge.invokeCalls[0].payload.params.id);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("sends an id the Rust validator accepts", async () => {
    const bridge = loadNotificationBridge();
    new bridge.Notification("Ann");
    await bridge.settle();

    const { id } = bridge.invokeCalls[0].payload.params;
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("does not fire a phantom click on focus when the platform reports clicks", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    const notif = new bridge.Notification("Ann");
    const handler = vi.fn();
    notif.onclick = handler;
    await bridge.settle();

    bridge.focusWindow();

    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to focus when the platform reports no click", async () => {
    const bridge = loadNotificationBridge({ nativeClick: false });
    const notif = new bridge.Notification("Ann");
    const handler = vi.fn();
    notif.onclick = handler;
    await bridge.settle();

    bridge.focusWindow();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires the focus fallback only once", async () => {
    const bridge = loadNotificationBridge({ nativeClick: false });
    const notif = new bridge.Notification("Ann");
    const handler = vi.fn();
    notif.onclick = handler;
    await bridge.settle();

    bridge.focusWindow();
    bridge.focusWindow();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("skips the focus fallback for notifications raised while the page was focused", async () => {
    const bridge = loadNotificationBridge({
      nativeClick: false,
      hasFocus: true,
    });
    const notif = new bridge.Notification("Ann");
    const handler = vi.fn();
    notif.onclick = handler;
    await bridge.settle();

    bridge.focusWindow();

    expect(handler).not.toHaveBeenCalled();
  });

  it("cancels the focus fallback after the user interacts with the page", async () => {
    const bridge = loadNotificationBridge({ nativeClick: false });
    const notif = new bridge.Notification("Ann");
    const handler = vi.fn();
    notif.onclick = handler;
    await bridge.settle();

    bridge.clickInPage();
    bridge.focusWindow();

    expect(handler).not.toHaveBeenCalled();
  });

  it("targets the newest notification when several are pending", async () => {
    const bridge = loadNotificationBridge({ nativeClick: false });
    const older = new bridge.Notification("Ann");
    const newer = new bridge.Notification("Bo");
    const olderHandler = vi.fn();
    const newerHandler = vi.fn();
    older.onclick = olderHandler;
    newer.onclick = newerHandler;
    await bridge.settle();

    bridge.focusWindow();

    expect(olderHandler).not.toHaveBeenCalled();
    expect(newerHandler).toHaveBeenCalledTimes(1);
  });

  it("stops routing clicks to a notification replaced by the same tag", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    const older = new bridge.Notification("Ann", { tag: "dm-ann" });
    const olderHandler = vi.fn();
    older.onclick = olderHandler;
    await bridge.settle();
    const olderId = bridge.invokeCalls[0].payload.params.id;

    new bridge.Notification("Ann again", { tag: "dm-ann" });
    await bridge.settle();

    bridge.notificationClick(olderId);

    expect(olderHandler).not.toHaveBeenCalled();
  });

  it("stops routing clicks after close() and reports the close", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    const notif = new bridge.Notification("Ann");
    await bridge.settle();
    const { id } = bridge.invokeCalls[0].payload.params;

    const clickHandler = vi.fn();
    const closeHandler = vi.fn();
    notif.onclick = clickHandler;
    notif.onclose = closeHandler;

    notif.close();
    bridge.notificationClick(id);

    expect(closeHandler).toHaveBeenCalledTimes(1);
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it("exposes the standard permission surface", async () => {
    const bridge = loadNotificationBridge();

    expect(bridge.Notification.permission).toBe("granted");
    await expect(bridge.Notification.requestPermission()).resolves.toBe(
      "granted",
    );
    const callback = vi.fn();
    await bridge.Notification.requestPermission(callback);
    expect(callback).toHaveBeenCalledWith("granted");
  });

  it("resolves a root-relative icon against the page origin", async () => {
    const bridge = loadNotificationBridge();
    new bridge.Notification("Ann", { icon: "/avatar.png" });
    await bridge.settle();

    expect(bridge.invokeCalls[0].payload.params.icon).toBe(
      "https://app.slack.com/avatar.png",
    );
  });
});
