(function () {
  "use strict";

  // YouTube Music adblock injection.
  // To test outside Pake, load this file (or the matching .css) in any webpage
  // that contains the selectors below, or use the test fixture at
  // tests/fixtures/youtubemusic-adblock.html.

  // Known YouTube Music / shared YouTube ad-related selectors.
  const AD_SELECTORS = [
    "ytmusic-ad-slot-renderer",
    ".ytmusic-ad-slot-renderer",
    "ytmusic-player-bar-ad-slot",
    "ytmusic-clip-ad-renderer",
    "ytmusic-ad-avatar-renderer",
    "ytmusic-ad-hero-image-renderer",
    "ytmusic-ad-title-renderer",
    "ytmusic-ad-badge-renderer",
    // Shared YouTube ad elements that can appear in the music player.
    "ytd-ad-slot-renderer",
    ".ytd-ad-slot-renderer",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-progress-list",
    ".ytp-ad-text",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-overlay-slot",
    ".ytp-ad-player-overlay",
    ".ytp-ad-player-overlay-instream-info",
    ".video-ads",
    "#player-ads",
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
  ];

  const AD_RESPONSE_KEYS = ["adPlacements", "playerAds", "adSlots"];

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
    AD_RESPONSE_KEYS.forEach((key) => {
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

  // Replace ad-related keys in YouTube Music network responses so the player
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
      AD_RESPONSE_KEYS.forEach((key, index) => {
        const pattern = new RegExp(`"${key}"`, "g");
        modified = modified.replace(pattern, `"_pa_${index}"`);
      });
      return modified;
    };

    const isYoutubeMusicRequest = (url) => {
      try {
        const s = typeof url === "string" ? url : String(url);
        return (
          s.includes("music.youtube.com") ||
          s.includes("youtube.com/youtubei/v1")
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

  function init() {
    hideAds();
    interceptPlayerResponse();
    interceptNetwork();

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
