import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/youtube_adblock.js"),
  "utf8",
);

function run({
  host = "www.youtube.com",
  enabled = true,
  querySelector = () => null,
} = {}) {
  const removed = [];
  const context = {
    window: {
      pakeConfig: { adblock: { enabled, profile: "youtube" } },
      location: { hostname: host },
      __TAURI__: { core: { invoke: vi.fn(() => Promise.resolve(true)) } },
    },
    document: {
      documentElement: { appendChild: vi.fn() },
      createElement: () => ({ id: "", textContent: "", remove: vi.fn() }),
      querySelectorAll: (selector) => [
        { remove: () => removed.push(selector) },
      ],
      querySelector,
    },
    MutationObserver: class {
      observe() {}
    },
    setInterval: vi.fn(),
    setTimeout: vi.fn((callback) => callback()),
    clearTimeout: vi.fn(),
    sessionStorage: { getItem: () => null, setItem: vi.fn() },
    console,
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context);
  return { context, removed };
}

describe("YouTube ad-block injection", () => {
  it("does not activate outside YouTube", () => {
    const { context } = run({ host: "example.com" });
    expect(context.window.pakeAdblock).toBeUndefined();
  });

  it("does not activate when the profile is disabled", () => {
    const { context } = run({ enabled: false });
    expect(context.window.pakeAdblock).toBeUndefined();
  });

  it("exposes a session control and removes explicit ad containers", () => {
    const { context, removed } = run();
    expect(context.window.pakeAdblock.isEnabled()).toBe(true);
    expect(removed).toContain("ytd-display-ad-renderer");
    expect(removed).not.toContain("ytd-video-renderer");
  });
});
