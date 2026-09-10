import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadFrame(config = {}) {
  const messages = [];
  const nativeWindow = {};
  const nativeOpen = vi.fn(() => nativeWindow);
  const listeners = {};
  const context = {
    URL,
    console,
    window: {
      location: { href: "https://mail.example.com/app" },
      pakeConfig: { url: "https://mail.example.com/app", ...config },
      top: { postMessage: (message) => messages.push(message) },
      open: nativeOpen,
      addEventListener: () => {},
    },
    document: {
      baseURI: "https://mail.example.com/app",
      addEventListener: (name, fn) => {
        listeners[name] = fn;
      },
    },
  };
  for (const file of ["link_policy.js", "auth.js", "frame_links.js"]) {
    runInNewContext(
      fs.readFileSync(
        path.join(process.cwd(), "src-tauri/src/inject", file),
        "utf8",
      ),
      context,
    );
  }
  return { ...context, messages, nativeOpen, nativeWindow, listeners };
}

describe("subframe external links", () => {
  it.each([false, true])(
    "normalizes omitted and empty popups with force_internal_navigation=%s",
    (force_internal_navigation) => {
      const frame = loadFrame({ force_internal_navigation });
      for (const url of [undefined, "", "  "]) {
        expect(frame.window.open(url, "_blank")).toBe(frame.nativeWindow);
        expect(frame.nativeOpen).toHaveBeenLastCalledWith(
          "about:blank",
          "_blank",
          undefined,
        );
      }
      expect(frame.messages).toEqual([]);
    },
  );

  it("injects only the shared policy and frame bridge into subframes", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src-tauri/src/app/window.rs"),
      "utf8",
    );
    expect(source).toContain(
      ".initialization_script_for_all_frames(&config_script)",
    );
    for (const file of ["link_policy.js", "auth.js", "frame_links.js"]) {
      expect(source).toContain(
        `.initialization_script_for_all_frames(include_str!("../inject/${file}"))`,
      );
    }
    expect(source).toContain(
      '.initialization_script(include_str!("../inject/event.js"))',
    );
  });
  it.each([false, true])(
    "forwards final external URLs with new_window=%s",
    (new_window) => {
      const frame = loadFrame({ new_window });
      expect(
        frame.window.open("https://outside.example/article", "_blank"),
      ).toBeNull();
      expect(frame.messages).toEqual([
        {
          type: "pake:frame-external-link",
          url: "https://outside.example/article",
        },
      ]);
      expect(frame.nativeOpen).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["https://outside.example/article", "details", {}],
    ["https://outside.example/article", "_self", {}],
    ["https://outside.example/article", "_parent", {}],
    ["https://outside.example/article", "_top", {}],
    ["/message/42", "_blank", {}],
    ["about:blank", "_blank", {}],
    ["", "_blank", {}],
    ["  #message", "_blank", {}],
    ["https://appleid.apple.com/auth/authorize", "AppleAuthentication", {}],
    ["about:blank", "AppleAuthentication", {}],
    ["https://accounts.google.com/o/oauth2/auth", "oauth", {}],
    [
      "https://outside.example/article",
      "_blank",
      { force_internal_navigation: true },
    ],
    [
      "https://outside.example/article",
      "_blank",
      { internal_url_regex: "outside\\.example" },
    ],
    ["file:///tmp/article", "_blank", {}],
    ["javascript:void(0)", "_blank", {}],
  ])("preserves native semantics for %s (%s)", (url, name, config) => {
    const frame = loadFrame(config);
    expect(frame.window.open(url, name, "width=400")).toBe(frame.nativeWindow);
    expect(frame.nativeOpen).toHaveBeenCalledWith(
      url === "" ? "about:blank" : url,
      name,
      "width=400",
    );
    expect(frame.messages).toEqual([]);
  });

  it("forwards external anchors while preserving downloads and named frames", () => {
    const frame = loadFrame();
    const anchor = {
      target: "_blank",
      hasAttribute: () => false,
      getAttribute: () => "https://outside.example/article",
    };
    const event = {
      target: { closest: () => anchor },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    frame.listeners.click(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(frame.messages).toHaveLength(1);
    anchor.hasAttribute = () => true;
    frame.listeners.click(event);
    anchor.hasAttribute = () => false;
    anchor.target = "details-frame";
    frame.listeners.click(event);
    expect(frame.messages).toHaveLength(1);
  });
});

describe("protocol link fallback", () => {
  it.each([
    ["", {}, false, false, true],
    ["_blank", {}, false, false, true],
    ["_self", {}, false, false, true],
    ["_new", {}, false, false, true],
    ["details", {}, false, false, false],
    ["", {}, true, false, false],
    ["", {}, false, true, false],
    ["", { force_internal_navigation: true }, false, false, false],
    ["", { internal_url_regex: "^mailto:" }, false, false, false],
  ])(
    "respects target=%s config=%j download=%s canceled=%s",
    (target, config, download, canceled, opens) => {
      const frame = loadFrame(config);
      const open = vi.fn();
      const event = {
        defaultPrevented: canceled,
        target: {
          closest: () => ({
            href: "mailto:person@example.com",
            target,
            hasAttribute: () => download,
          }),
        },
        preventDefault: vi.fn(),
      };
      frame.handleProtocolLinkClick(event, open);
      expect(open).toHaveBeenCalledTimes(opens ? 1 : 0);
      expect(event.preventDefault).toHaveBeenCalledTimes(opens ? 1 : 0);
    },
  );
});
