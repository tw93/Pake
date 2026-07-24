(function () {
  "use strict";

  // YouTube Music adblock injection.
  //
  // Adapted from proven community userscripts:
  // - YouTube DeAd by mragonias (MIT) — API response blocking
  // - YouTube Ads-Bypass by WakeUpNeo (MIT) — player class observation & fast-forward
  // - YouTube Music Pro Audio Enhancer + Ad Blocker by huypro — YT Music selectors
  //
  // To test outside Pake, load this file (or the matching .css) in any webpage
  // that contains the selectors below, or use the test fixture at
  // tests/fixtures/youtubemusic-adblock.html.

  // Known YouTube Music / shared YouTube ad-related selectors.
  const AD_SELECTORS = [
    // YouTube Music specific.
    "ytmusic-ad-slot-renderer",
    ".ytmusic-ad-slot-renderer",
    "ytmusic-player-bar-ad-slot",
    "ytmusic-clip-ad-renderer",
    "ytmusic-ad-avatar-renderer",
    "ytmusic-ad-hero-image-renderer",
    "ytmusic-ad-title-renderer",
    "ytmusic-ad-badge-renderer",
    "ytmusic-mealbar-promo-renderer",
    'ytmusic-popup-container:has(a[href="/premium"])',
    // Shared YouTube ad UI that can appear in the music player.
    "ytd-ad-slot-renderer",
    ".ytd-ad-slot-renderer",
    "ytd-companion-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-endpoint-ad-renderer",
    "ytd-shorts-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-ad-selection-preview-renderer",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    "tp-yt-paper-dialog:has(#feedback.ytd-enforcement-message-view-model)",
    ".yt-mealbar-promo-renderer",
    "#masthead-ad",
    "#player-ads",
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-progress-list",
    ".ytp-ad-text",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-overlay-slot",
    ".ytp-ad-player-overlay",
    ".ytp-ad-player-overlay-instream-info",
    ".ytp-ad-player-overlay-layout__player-card-container",
    ".ytp-ad-player-overlay-layout__ad-info-container",
    ".ytp-ad-player-overlay-layout__ad-disclosure-banner-container",
    ".ytp-ad-message-container",
    ".ytp-ad-image-overlay",
    ".ytp-ad-avatar",
    ".ytp-ad-button-vm",
    ".ytp-cued-thumbnail-overlay",
    ".ytd-display-ad-renderer",
    ".ad-container",
    // Promotional shelves.
    'ytmusic-shelf-renderer[subheader*="Sponsored"]',
    'ytmusic-shelf-renderer[subheader*="Ad"]',
    'ytmusic-carousel-shelf-renderer[subheader*="Sponsored"]',
    'ytmusic-carousel-shelf-renderer[subheader*="Ad"]',
  ];

  const SKIP_BUTTON_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    "button.ytp-ad-skip-button",
    "button.ytp-skip-ad-button",
    ".ytp-ad-skip-button-slot",
    ".ytp-ad-skip-button-container",
  ];

  const PLAYER_SELECTORS = [
    "#movie_player",
    ".html5-video-player",
    "ytmusic-player",
    "#player",
  ];

  const AD_PLAYER_CLASSES = [
    "ad-showing",
    "ad-interrupting",
    "ytp-ad-player-overlay",
    "ytp-ad-display-override",
  ];

  const AD_RESPONSE_KEYS = {
    adSlots: "blockedSlots",
    adPlacements: "blockedPlacements",
    playerAds: "blockedPlayerAds",
  };

  // Injected CSS used as a fallback when the script runs without the matching .css file.
  function injectFallbackCSS() {
    const id = "pake-ytmusic-adblock-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.setAttribute("id", id);
    style.textContent = `${AD_SELECTORS.join(", ")} {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }`;
    (document.head || document.body).appendChild(style);
  }

  function hideElement(el) {
    if (!el) return;
    el.style.display = "none";
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    if (!el.hasAttribute("hidden")) {
      el.setAttribute("hidden", "");
    }
  }

  function hideAds() {
    AD_SELECTORS.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach(hideElement);
      } catch (e) {
        // Ignore invalid selectors (e.g. :has on older browsers).
      }
    });
  }

  function clickSkipButtons() {
    SKIP_BUTTON_SELECTORS.forEach((selector) => {
      try {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          btn.click();
        }
      } catch (e) {
        // Ignore invalid selectors.
      }
    });
  }

  function stripPlayerAds(obj) {
    if (!obj || typeof obj !== "object") return;
    Object.keys(AD_RESPONSE_KEYS).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        obj[key] = undefined;
      }
    });
  }

  // Defuse ad data baked into the initial player response or assigned later.
  function interceptPlayerResponse() {
    ["ytInitialPlayerResponse", "playerResponse"].forEach((prop) => {
      let current = window[prop];
      if (current) stripPlayerAds(current);

      try {
        Object.defineProperty(window, prop, {
          configurable: true,
          get() {
            return current;
          },
          set(value) {
            stripPlayerAds(value);
            current = value;
            return true;
          },
        });
      } catch (e) {
        // Property may already be non-configurable; ignore.
      }
    });
  }

  // Rename ad-related keys in YouTube Music network responses so the player
  // does not schedule video/audio ad breaks.
  function interceptNetwork() {
    if (
      typeof XMLHttpRequest === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const replaceAds = (text) => {
      if (typeof text !== "string") return text;
      let modified = text;
      Object.keys(AD_RESPONSE_KEYS).forEach((key) => {
        const pattern = new RegExp(`"${key}"`, "g");
        modified = modified.replace(pattern, `"${AD_RESPONSE_KEYS[key]}"`);
      });
      return modified;
    };

    const isYoutubeMusicRequest = (url) => {
      try {
        const s = typeof url === "string" ? url : String(url);
        return (
          s.includes("music.youtube.com") ||
          s.includes("youtube.com/youtubei/v1") ||
          s.includes("youtube.com/watch")
        );
      } catch (e) {
        return false;
      }
    };

    const origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function fetchPatched(...args) {
        return origFetch.apply(this, args).then(async (response) => {
          if (!isYoutubeMusicRequest(args[0])) return response;
          try {
            const text = await response.clone().text();
            const modified = replaceAds(text);
            if (modified === text) return response;
            return new Response(modified, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (e) {
            return response;
          }
        });
      };
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function openPatched(method, url, ...rest) {
      this._pakeUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function sendPatched(...args) {
      if (isYoutubeMusicRequest(this._pakeUrl)) {
        const xhr = this;
        const onReady = () => {
          if (xhr.readyState !== 4) return;
          try {
            const text = xhr.responseText;
            if (!text) return;
            const modified = replaceAds(text);
            if (modified === text) return;
            const originalResponse = xhr.response;
            Object.defineProperty(xhr, "responseText", {
              configurable: true,
              get() {
                return modified;
              },
            });
            Object.defineProperty(xhr, "response", {
              configurable: true,
              get() {
                if (
                  xhr.responseType === "" ||
                  xhr.responseType === "text" ||
                  xhr.responseType === "json"
                ) {
                  return modified;
                }
                return originalResponse;
              },
            });
          } catch (e) {
            // Ignore read-only or detached XHRs.
          }
        };
        xhr.addEventListener("readystatechange", onReady);
        xhr.addEventListener("load", onReady);
      }
      return origSend.apply(this, args);
    };
  }

  // Detect ad playback from player class changes and fast-forward through it.
  function interceptPlayerAds() {
    let player = null;
    let playerObserver = null;
    let video = null;

    const isAdActive = () =>
      AD_PLAYER_CLASSES.some((cls) => player && player.classList.contains(cls));

    const findPlayer = () => {
      for (const selector of PLAYER_SELECTORS) {
        player = document.querySelector(selector);
        if (player) return true;
      }
      return false;
    };

    const restoreVideo = () => {
      if (!video) return;
      if (video.muted) video.muted = false;
      if (video.playbackRate > 1) video.playbackRate = 1;
      if (video.style.display === "none") video.style.display = "";
    };

    const skipAd = () => {
      video = player.querySelector("video");
      if (!video) return;

      clickSkipButtons();

      if (isAdActive()) {
        if (!video.muted) video.muted = true;
        // Try to reach the end of the ad as soon as possible.
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration - 0.1;
        } else if (video.playbackRate < 16) {
          video.playbackRate = 16;
        }
      } else {
        restoreVideo();
      }
    };

    const setupObserver = () => {
      if (playerObserver || !findPlayer()) return;
      video = player.querySelector("video");
      playerObserver = new MutationObserver(skipAd);
      playerObserver.observe(player, {
        attributes: true,
        attributeFilter: ["class"],
      });
      skipAd();
    };

    const bodyObserver = new MutationObserver(() => {
      if (!player || !player.isConnected) {
        playerObserver?.disconnect();
        playerObserver = null;
        player = null;
        setupObserver();
      }
    });

    if (document.body) {
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
    setupObserver();
  }

  function init() {
    injectFallbackCSS();
    hideAds();
    interceptPlayerResponse();
    interceptNetwork();
    interceptPlayerAds();

    let observer;
    if (document.body) {
      observer = new MutationObserver(hideAds);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setInterval(() => {
      hideAds();
      clickSkipButtons();
    }, 1000);

    return observer;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
