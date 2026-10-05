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
  suppressed = false,
  hasFocus = false,
  deferSend = false,
  legacyEventTarget = false,
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
  const sendRequests = [];
  const body = createElement("body");

  const context = {
    console,
    URL,
    Event,
    EventTarget: legacyEventTarget
      ? class extends EventTarget {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
        }
      : EventTarget,
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
              if (deferSend) {
                return new Promise((resolve, reject) => {
                  sendRequests.push({ resolve, reject, payload });
                });
              }
              return Promise.resolve({ nativeClick, suppressed });
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
      createDocumentFragment: () => new EventTarget(),
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
    sendRequests,
    focusWindow: () => fire(windowListeners, "focus", new Event("focus")),
    clickInPage: () => fire(documentListeners, "click", new Event("click")),
    // Drain the invoke promise chain that records the fallback state.
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

describe("notification bridge", () => {
  it("preserves native event identity when EventTarget is not constructible", async () => {
    const bridge = loadNotificationBridge({
      nativeClick: true,
      legacyEventTarget: true,
    });
    const notification = new bridge.Notification("Legacy WebKit");
    const clicks = [];
    notification.addEventListener("click", (event) => {
      clicks.push([event.target, event.currentTarget]);
    });
    await bridge.settle();
    bridge.notificationClick(notification._id);
    expect(clicks).toEqual([[notification, notification]]);
    notification.close();
    expect(bridge.invokeCalls.at(-1)).toEqual({
      command: "close_notification",
      payload: { id: notification._id },
    });
  });

  it("queues close events so replacement cannot synchronously reenter Map iteration", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    let closeCalls = 0;
    const retry = () => {
      const notification = new bridge.Notification("retry", { tag: "thread" });
      notification.onclose = () => {
        closeCalls++;
        if (closeCalls < 4) retry();
      };
    };
    retry();
    new bridge.Notification("replacement", { tag: "thread" });
    expect(closeCalls).toBe(0);
    await bridge.settle();
    expect(closeCalls).toBe(1);
  });
  it("keeps the newest focus target when replies arrive out of order", async () => {
    const bridge = loadNotificationBridge({ deferSend: true });
    const older = new bridge.Notification("older");
    const newer = new bridge.Notification("newer");
    const oldClick = vi.fn();
    const newClick = vi.fn();
    older.onclick = oldClick;
    newer.onclick = newClick;
    bridge.sendRequests[1].resolve({ nativeClick: false });
    await bridge.settle();
    bridge.sendRequests[0].resolve({ nativeClick: false });
    await bridge.settle();
    bridge.focusWindow();
    expect(oldClick).not.toHaveBeenCalled();
    expect(newClick).toHaveBeenCalledTimes(1);
  });

  it("does not revive a closed notification when delivery completes", async () => {
    const bridge = loadNotificationBridge({ deferSend: true });
    const notif = new bridge.Notification("closed");
    const show = vi.fn();
    const close = vi.fn();
    notif.onshow = show;
    notif.onclose = close;
    notif.close();
    notif.close();
    bridge.sendRequests[0].resolve({ nativeClick: true });
    await bridge.settle();
    expect(show).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(
      bridge.invokeCalls.filter(
        (call) => call.command === "increment_dock_badge",
      ),
    ).toHaveLength(0);
    expect(bridge.invokeCalls).toContainEqual({
      command: "close_notification",
      payload: { id: bridge.sendRequests[0].payload.params.id },
    });
  });

  it("does not rearm a focus click or badge after an interaction before the reply", async () => {
    const bridge = loadNotificationBridge({ deferSend: true });
    const notif = new bridge.Notification("already read");
    const click = vi.fn();
    notif.onclick = click;
    bridge.clickInPage();
    bridge.sendRequests[0].resolve({ nativeClick: false });
    await bridge.settle();
    bridge.focusWindow();
    expect(click).not.toHaveBeenCalled();
    expect(
      bridge.invokeCalls.filter(
        (call) => call.command === "increment_dock_badge",
      ),
    ).toHaveLength(0);
  });

  it("withdraws the old native notification on a tag replacement", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    new bridge.Notification("older", { tag: "thread" });
    await bridge.settle();
    const oldId = bridge.invokeCalls[0].payload.params.id;
    new bridge.Notification("newer", { tag: "thread" });
    await bridge.settle();
    expect(bridge.invokeCalls).toContainEqual({
      command: "close_notification",
      payload: { id: oldId },
    });
  });

  it("does not revive replaced notifications on late errors or successful deliveries", async () => {
    const bridge = loadNotificationBridge({ deferSend: true });
    const older = new bridge.Notification("older", { tag: "thread" });
    const middle = new bridge.Notification("middle", { tag: "thread" });
    const newest = new bridge.Notification("newest", { tag: "thread" });
    const oldError = vi.fn();
    const middleShow = vi.fn();
    const newestClick = vi.fn();
    older.onerror = oldError;
    middle.onshow = middleShow;
    newest.onclick = newestClick;
    bridge.sendRequests[2].resolve({ nativeClick: true });
    bridge.sendRequests[1].resolve({ nativeClick: true });
    bridge.sendRequests[0].reject(new Error("late delivery failure"));
    await bridge.settle();
    bridge.notificationClick(bridge.sendRequests[2].payload.params.id);
    expect(oldError).not.toHaveBeenCalled();
    expect(middleShow).not.toHaveBeenCalled();
    expect(newestClick).toHaveBeenCalledTimes(1);
    expect(
      bridge.invokeCalls.filter(
        (call) =>
          call.command === "close_notification" &&
          call.payload.id === bridge.sendRequests[1].payload.params.id,
      ),
    ).toHaveLength(2);
  });

  it("validates native click callback ids even if they come from old stored notifications", () => {
    const source = fs.readFileSync("src-tauri/src/app/notification.rs", "utf8");
    const callback = source.slice(
      source.indexOf("fn did_activate("),
      source.indexOf("fn should_present("),
    );
    expect(callback).toContain("validate_id(id)");
  });

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
    await bridge.settle();
    bridge.notificationClick(id);

    expect(closeHandler).toHaveBeenCalledTimes(1);
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it("stops tracking a notification another window already raised", async () => {
    const bridge = loadNotificationBridge({
      nativeClick: true,
      suppressed: true,
    });
    const notif = new bridge.Notification("Ann");
    const clickHandler = vi.fn();
    const showHandler = vi.fn();
    notif.onclick = clickHandler;
    notif.onshow = showHandler;
    await bridge.settle();

    const { id } = bridge.invokeCalls[0].payload.params;
    bridge.notificationClick(id);

    expect(clickHandler).not.toHaveBeenCalled();
    expect(showHandler).not.toHaveBeenCalled();
  });

  it("does not count a suppressed notification towards the badge", async () => {
    const bridge = loadNotificationBridge({
      nativeClick: true,
      suppressed: true,
    });
    new bridge.Notification("Ann");
    await bridge.settle();

    expect(bridge.invokeCalls.map(({ command }) => command)).not.toContain(
      "increment_dock_badge",
    );
  });

  it("lets a suppressed window clear the shared badge on interaction", async () => {
    const bridge = loadNotificationBridge({
      nativeClick: true,
      suppressed: true,
    });
    new bridge.Notification("Ann");
    await bridge.settle();

    bridge.clickInPage();

    const commands = bridge.invokeCalls.map(({ command }) => command);
    expect(commands).toContain("clear_dock_badge");
    expect(commands).not.toContain("increment_dock_badge");
  });

  it("counts a delivered notification towards the badge", async () => {
    const bridge = loadNotificationBridge({ nativeClick: true });
    new bridge.Notification("Ann");
    await bridge.settle();

    expect(bridge.invokeCalls.map(({ command }) => command)).toContain(
      "increment_dock_badge",
    );
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
