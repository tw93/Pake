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
  const intervals = [];
  const context = {
    window: {
      pakeConfig: { adblock: { enabled, profile: "youtube" } },
      location: { hostname: host, reload: vi.fn() },
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
    setInterval: vi.fn((callback) => {
      intervals.push(callback);
      return intervals.length;
    }),
    setTimeout: vi.fn((callback) => callback()),
    clearTimeout: vi.fn(),
    sessionStorage: {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    console,
  };
  context.window.window = context.window;
  context.intervals = intervals;
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

  it("requests native recovery once for a known anti-block state", async () => {
    const { context } = run();
    context.window.pakeAdblock.recover("anti-adblock");
    context.window.pakeAdblock.recover("anti-adblock");
    await Promise.resolve();
    expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledTimes(1);
    expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledWith(
      "disable_adblock_for_session",
      { reason: "anti-adblock" },
    );
  });

  it("recovers only after 15 seconds without ad playback progress", () => {
    const video = { currentTime: 3, duration: 30, muted: false, paused: false };
    const player = { querySelector: () => video };
    const { context } = run({
      querySelector: (selector) =>
        selector === ".html5-video-player.ad-showing" ? player : null,
    });

    context.window.pakeAdblock.checkPlaybackStall(1_000);
    context.window.pakeAdblock.checkPlaybackStall(15_999);
    expect(context.window.__TAURI__.core.invoke).not.toHaveBeenCalled();

    context.window.pakeAdblock.checkPlaybackStall(16_000);
    expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledWith(
      "disable_adblock_for_session",
      { reason: "ad-playback-stall" },
    );
  });

  it("periodically skips player ads that appear after startup", () => {
    const video = { currentTime: 3, duration: 30, muted: false, paused: false };
    const player = { querySelector: () => video };
    let adPlayer = null;
    const { context } = run({
      querySelector: (selector) =>
        selector === ".html5-video-player.ad-showing" ? adPlayer : null,
    });

    expect(video.currentTime).toBe(3);

    adPlayer = player;
    context.intervals.forEach((callback) => callback());

    expect(video.muted).toBe(true);
    expect(video.currentTime).toBe(30);
  });
});
