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
  search = "",
  withConfig = true,
  fetchImpl,
  responseClass,
  querySelector = () => null,
  querySelectorAll,
} = {}) {
  const removed = [];
  const intervals = [];
  const context = {
    window: {
      location: { hostname: host, search, reload: vi.fn() },
      __TAURI__: { core: { invoke: vi.fn(() => Promise.resolve(true)) } },
    },
    document: {
      title: "YouTube",
      documentElement: { appendChild: vi.fn() },
      createElement: () => ({ id: "", textContent: "", remove: vi.fn() }),
      querySelectorAll:
        querySelectorAll ??
        ((selector) => [{ remove: () => removed.push(selector) }]),
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
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    },
    fetch: fetchImpl,
    Response: responseClass,
    URL,
    console,
  };
  if (fetchImpl) context.window.fetch = fetchImpl;
  if (responseClass) context.window.Response = responseClass;
  if (withConfig) {
    context.window.pakeConfig = {
      adblock: { enabled, profile: "youtube" },
      url: `https://${host}/${search}`,
    };
  }
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

  it("activates after an early non-YouTube startup document navigates to YouTube", () => {
    const { context, removed } = run({ host: "" });
    expect(context.window.pakeAdblock).toBeUndefined();

    context.window.location.hostname = "www.youtube.com";
    context.intervals.forEach((callback) => callback());

    expect(context.window.pakeAdblock.isEnabled()).toBe(true);
    expect(removed).toContain("ytd-display-ad-renderer");
  });

  it("activates after pakeConfig becomes available late", () => {
    const { context, removed } = run({
      host: "www.youtube.com",
      withConfig: false,
    });
    expect(context.window.pakeAdblock).toBeUndefined();

    context.window.pakeConfig = {
      adblock: { enabled: true, profile: "youtube" },
    };
    context.intervals.forEach((callback) => callback());

    expect(context.window.pakeAdblock.isEnabled()).toBe(true);
    expect(removed).toContain("ytd-display-ad-renderer");
  });

  it("does not activate when the profile is disabled", () => {
    const { context } = run({ enabled: false });
    expect(context.window.pakeAdblock).toBeUndefined();
  });

  it("exposes a session control and removes explicit ad containers", () => {
    const { context, removed } = run();
    expect(context.window.pakeAdblock.isEnabled()).toBe(true);
    expect(removed).toContain("ytd-display-ad-renderer");
    expect(removed).toContain("ytd-promoted-video-renderer");
    expect(removed).toContain(
      "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    );
    expect(removed).toContain("ytd-companion-slot-renderer");
    expect(removed).toContain("ytd-action-companion-ad-renderer");
    expect(removed).not.toContain("ytd-video-renderer");
  });

  it("does not install duplicate maintenance timers when injected twice", () => {
    const { context } = run();
    const intervalCount = context.intervals.length;

    vm.runInNewContext(source, context);

    expect(context.intervals).toHaveLength(intervalCount);
  });

  it("continues cleaning and rendering diagnostics when one selector is unsupported", () => {
    const removedSelectors = [];
    const { context } = run({
      search: "?pake-adblock-debug=1",
      querySelectorAll: (selector) => {
        if (selector.includes(":has(")) {
          throw new Error("Unsupported selector");
        }
        return [{ remove: () => removedSelectors.push(selector) }];
      },
    });

    expect(removedSelectors).toContain("ytd-display-ad-renderer");
    expect(context.document.title).toBe("PakeAdblock ON | YouTube");
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

  it("skips player ads when only ad overlay markers are present", () => {
    const video = { currentTime: 2, duration: 20, muted: false, paused: false };
    let overlayVisible = false;
    const { context } = run({
      querySelector: (selector) => {
        if (selector === "video") return video;
        if (selector === ".html5-video-player.ad-showing") return null;
        if (selector === ".video-ads .ytp-ad-module" && overlayVisible) {
          return { nodeType: 1 };
        }
        return null;
      },
    });

    overlayVisible = true;
    context.intervals.forEach((callback) => callback());

    expect(video.muted).toBe(true);
    expect(video.currentTime).toBe(20);
  });

  it("accelerates player ads when YouTube reports an unknown ad duration", () => {
    const video = {
      currentTime: 0,
      duration: Number.NaN,
      muted: false,
      paused: false,
      playbackRate: 1,
    };
    const player = { querySelector: () => video };
    const { context } = run({
      querySelector: (selector) =>
        selector === ".html5-video-player.ad-showing" ? player : null,
    });

    context.intervals.forEach((callback) => callback());

    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(16);
    expect(video.currentTime).toBeGreaterThanOrEqual(10);
  });

  it("exposes debug state when diagnostics are enabled", () => {
    const video = { currentTime: 2, duration: 20, muted: false, paused: false };
    const { context } = run({
      search: "?pake-adblock-debug=1",
      querySelector: (selector) => {
        if (selector === "video") return video;
        if (selector === ".html5-video-player.ad-showing") return null;
        if (selector === ".video-ads .ytp-ad-module") return { nodeType: 1 };
        return null;
      },
    });

    context.intervals.forEach((callback) => callback());

    expect(context.window.pakeAdblock.getDebugState()).toMatchObject({
      active: true,
      enabled: true,
      matchedPlayerAdMarkers: [".video-ads .ytp-ad-module"],
      video: {
        currentTime: 20,
        duration: 20,
        muted: true,
        paused: false,
      },
    });
    expect(context.document.title).toBe("PakeAdblock ON | YouTube");
  });

  it("keeps diagnostics enabled when YouTube strips the debug query from the page URL", () => {
    const { context } = run({
      search: "",
      withConfig: false,
    });

    context.window.pakeConfig = {
      adblock: { enabled: true, profile: "youtube" },
      url: "https://www.youtube.com/?pake-adblock-debug=1",
    };
    context.intervals.forEach((callback) => callback());

    expect(context.localStorage.setItem).toHaveBeenCalledWith(
      "pake-youtube-adblock-debug",
      "1",
    );
    expect(context.document.title).toBe("PakeAdblock ON | YouTube");
  });

  it("sanitizes YouTube player JSON ad payloads before page code reads them", async () => {
    class FakeResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status ?? 200;
        this.statusText = init.statusText ?? "OK";
        this.headers = init.headers ?? {};
      }
      clone() {
        return new FakeResponse(this.body, {
          status: this.status,
          statusText: this.statusText,
          headers: this.headers,
        });
      }
      async json() {
        return JSON.parse(this.body);
      }
      async text() {
        return this.body;
      }
    }
    const originalPayload = {
      videoDetails: { videoId: "abc123", title: "Normal video" },
      streamingData: { formats: [{ itag: 18 }] },
      adPlacements: [{ ad: "pre-roll" }],
      playerAds: [{ ad: "mid-roll" }],
      responseContext: {
        serviceTrackingParams: [],
        adSlots: [{ slot: "player" }],
      },
    };
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new FakeResponse(JSON.stringify(originalPayload))),
    );
    const { context } = run({
      fetchImpl,
      responseClass: FakeResponse,
    });

    const response = await context.window.fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    );
    const payload = await response.json();

    expect(payload.videoDetails).toEqual(originalPayload.videoDetails);
    expect(payload.streamingData).toEqual(originalPayload.streamingData);
    expect(payload.adPlacements).toBeUndefined();
    expect(payload.playerAds).toBeUndefined();
    expect(payload.responseContext.adSlots).toBeUndefined();
  });
});
