(() => {
  const supportedHosts = new Set(["www.youtube.com", "m.youtube.com"]);
  const loadedKey = "__pakeYoutubeAdblockLoaded";

  let started = false;
  const start = () => {
    if (started || window[loadedKey]) return true;
    const config = window.pakeConfig?.adblock;
    if (!config?.enabled || config.profile !== "youtube") return false;
    if (!supportedHosts.has(window.location.hostname)) return false;
    started = true;

    const recoveryKey = "pake-youtube-adblock-recovered";
    const disabledKey = "pake-youtube-adblock-disabled";
    const debugKey = "pake-youtube-adblock-debug";
    const debugRequested =
      (window.location.search || "").includes("pake-adblock-debug") ||
      (window.pakeConfig?.url || "").includes("pake-adblock-debug");
    if (debugRequested) localStorage.setItem(debugKey, "1");
    const debugEnabled =
      debugRequested || localStorage.getItem(debugKey) === "1";
    let recoveryRequested = sessionStorage.getItem(recoveryKey) === "1";
    let enabled = sessionStorage.getItem(disabledKey) !== "1";
    let debugPanel = null;
    let debugState = {
      active: true,
      enabled,
      recoveryRequested,
      matchedPlayerAdMarkers: [],
      matchedSkipSelectors: [],
      matchedAntiBlockSelectors: [],
      sanitizedPlayerResponses: 0,
      video: null,
    };
    let sanitizedPlayerResponses = 0;
    const selectors = [
      "ytd-display-ad-renderer",
      "ytd-ad-slot-renderer",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-promoted-video-renderer",
      "ytd-compact-promoted-video-renderer",
      "ytd-promoted-sparkles-text-search-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "ytd-companion-slot-renderer",
      "ytd-action-companion-ad-renderer",
      "ytd-companion-ad-renderer",
      "ytd-instream-companion-renderer",
      "ytd-player-legacy-desktop-watch-ads-renderer",
      'ytd-engagement-panel-section-list-renderer[target-id*="ads"]',
      "#panels [target-id*='ads']",
      "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
      "ytd-rich-section-renderer:has(ytd-ad-slot-renderer)",
      "#player-ads",
      "#masthead-ad",
      ".ytp-ad-overlay-container",
    ];
    const skipSelectors = [
      ".ytp-ad-skip-button",
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button-modern",
    ];
    const antiBlockSelectors = [
      "ytd-enforcement-message-view-model",
      "tp-yt-paper-dialog ytd-enforcement-message-view-model",
    ];
    const playerAdMarkers = [
      ".html5-video-player.ad-showing",
      ".video-ads .ytp-ad-module",
      ".ytp-ad-player-overlay",
      ".ytp-ad-text",
      ".ytp-ad-preview-container",
      ".ytp-ad-skip-button-container",
      ".ytp-ad-simple-ad-badge",
    ];
    const playerPayloadAdKeys = new Set([
      "adPlacements",
      "adSlots",
      "adBreakHeartbeatParams",
      "adBreakHeartbeat",
      "adParams",
      "adSafetyReason",
      "adSignalsInfo",
      "playerAds",
      "playerAdParams",
      "promotedSparklesWebRenderer",
      "companionAd",
      "instreamAdPlayerOverlayRenderer",
    ]);
    const sponsoredTextPattern = /\b(Sponsored|Patrocinado|Anuncio)\b/i;
    const sponsoredTextContainers = [
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
      "ytd-compact-video-renderer",
      "ytd-rich-section-renderer",
    ];
    const getRequestUrl = (input) => {
      if (typeof input === "string") return input;
      if (input instanceof URL) return input.href;
      return input?.url || "";
    };

    const isYouTubePlayerPayloadUrl = (input) => {
      const rawUrl = getRequestUrl(input);
      if (!rawUrl) return false;
      try {
        const url = new URL(rawUrl, window.location.href);
        return (
          supportedHosts.has(url.hostname) &&
          url.pathname.endsWith("/youtubei/v1/player")
        );
      } catch {
        return false;
      }
    };

    const stripPlayerAds = (value) => {
      if (Array.isArray(value)) {
        let changed = false;
        const next = value.map((item) => {
          const result = stripPlayerAds(item);
          changed ||= result.changed;
          return result.value;
        });
        return { value: changed ? next : value, changed };
      }
      if (!value || typeof value !== "object") {
        return { value, changed: false };
      }

      let changed = false;
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        if (playerPayloadAdKeys.has(key)) {
          changed = true;
          continue;
        }
        const result = stripPlayerAds(child);
        changed ||= result.changed;
        next[key] = result.value;
      }
      return { value: changed ? next : value, changed };
    };

    const sanitizePlayerText = (text) => {
      try {
        const result = stripPlayerAds(JSON.parse(text));
        return result.changed ? JSON.stringify(result.value) : text;
      } catch {
        return text;
      }
    };

    const sanitizePlayerResponse = async (response) => {
      if (!response?.clone) return response;
      const clone = response.clone();
      const text =
        typeof clone.text === "function"
          ? await clone.text()
          : JSON.stringify(await clone.json());
      const sanitizedText = sanitizePlayerText(text);
      if (sanitizedText === text) return response;

      sanitizedPlayerResponses += 1;
      const ResponseConstructor = window.Response || globalThis.Response;
      return new ResponseConstructor(sanitizedText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };

    const sanitizeXhrResponse = (xhr) => {
      if (!enabled || !isYouTubePlayerPayloadUrl(xhr.__pakeAdblockUrl)) return;
      if (xhr.readyState !== 4) return;

      const text =
        typeof xhr.responseText === "string"
          ? xhr.responseText
          : typeof xhr.response === "string"
            ? xhr.response
            : "";
      if (!text) return;

      const sanitizedText = sanitizePlayerText(text);
      if (sanitizedText === text) return;

      sanitizedPlayerResponses += 1;
      try {
        Object.defineProperty(xhr, "responseText", {
          configurable: true,
          value: sanitizedText,
        });
      } catch {}
      try {
        if (!xhr.responseType || xhr.responseType === "text") {
          Object.defineProperty(xhr, "response", {
            configurable: true,
            value: sanitizedText,
          });
        }
      } catch {}
    };

    const patchFetch = () => {
      const root = typeof globalThis === "undefined" ? window : globalThis;
      const nativeFetch = window.fetch || root.fetch;
      if (window.__pakeYoutubeAdblockFetchPatched || !nativeFetch) return;
      window.__pakeYoutubeAdblockFetchPatched = true;
      const patchedFetch = async function (...args) {
        const response = await nativeFetch.apply(this, args);
        if (!enabled || !isYouTubePlayerPayloadUrl(args[0])) return response;
        return sanitizePlayerResponse(response);
      };
      window.fetch = patchedFetch;
      root.fetch = patchedFetch;
    };

    const patchXmlHttpRequest = () => {
      const XMLHttpRequestConstructor = window.XMLHttpRequest;
      const prototype = XMLHttpRequestConstructor?.prototype;
      if (window.__pakeYoutubeAdblockXhrPatched || !prototype) return;
      window.__pakeYoutubeAdblockXhrPatched = true;

      const nativeOpen = prototype.open;
      const nativeSend = prototype.send;
      const nativeAddEventListener = prototype.addEventListener;
      if (!nativeOpen || !nativeSend) return;

      prototype.open = function (method, url, ...rest) {
        this.__pakeAdblockUrl = getRequestUrl(url);
        return nativeOpen.call(this, method, url, ...rest);
      };

      if (nativeAddEventListener) {
        prototype.addEventListener = function (type, listener, ...rest) {
          if (
            (type === "readystatechange" ||
              type === "load" ||
              type === "loadend") &&
            typeof listener === "function" &&
            !listener.__pakeAdblockWrapped
          ) {
            const xhr = this;
            const wrappedListener = function (...eventArgs) {
              sanitizeXhrResponse(xhr);
              return listener.apply(this, eventArgs);
            };
            wrappedListener.__pakeAdblockWrapped = true;
            return nativeAddEventListener.call(
              this,
              type,
              wrappedListener,
              ...rest,
            );
          }
          return nativeAddEventListener.call(this, type, listener, ...rest);
        };
      }

      prototype.send = function (...args) {
        const originalReadyStateChange = this.onreadystatechange;
        if (
          typeof originalReadyStateChange === "function" &&
          !originalReadyStateChange.__pakeAdblockWrapped
        ) {
          const xhr = this;
          const wrappedReadyStateChange = function (...eventArgs) {
            sanitizeXhrResponse(xhr);
            return originalReadyStateChange.apply(this, eventArgs);
          };
          wrappedReadyStateChange.__pakeAdblockWrapped = true;
          this.onreadystatechange = wrappedReadyStateChange;
        }

        const result = nativeSend.apply(this, args);
        sanitizeXhrResponse(this);
        return result;
      };
    };

    const recover = (reason) => {
      if (recoveryRequested) return;
      recoveryRequested = true;
      sessionStorage.setItem(recoveryKey, "1");
      sessionStorage.setItem(disabledKey, "1");
      window.__TAURI__?.core
        ?.invoke("disable_adblock_for_session", { reason })
        .then((disabled) => {
          if (disabled) window.location.reload();
        })
        .catch(() => {});
    };

    const querySelectorAllSafe = (selector) => {
      try {
        return document.querySelectorAll(selector);
      } catch {
        return [];
      }
    };

    const removeSponsoredTextAds = () => {
      for (const selector of sponsoredTextContainers) {
        querySelectorAllSafe(selector).forEach((node) => {
          const text = node.innerText || node.textContent || "";
          if (sponsoredTextPattern.test(text)) node.remove();
        });
      }
    };

    const buildStyleText = () =>
      [
        ...selectors.map(
          (selector) => `${selector} { display: none !important; }`,
        ),
        ".html5-video-player.ad-showing { background: #000 !important; }",
        [
          ".html5-video-player.ad-showing .html5-main-video",
          ".html5-video-player.ad-showing .ytp-ad-player-overlay",
          ".html5-video-player.ad-showing .ytp-ad-image-overlay",
          ".html5-video-player.ad-showing .ytp-ad-overlay-container",
          ".html5-video-player.ad-showing .ytp-ad-module",
          ".html5-video-player.ad-showing .video-ads",
          ".html5-video-player.ad-showing video",
        ].join(",") +
          " { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }",
        ".html5-video-player.ad-showing::after { content: ''; position: absolute; inset: 0; z-index: 2147483646; background: #000; pointer-events: none; }",
      ].join("\n");

    const getMatches = (selectorList) =>
      selectorList.filter((selector) => {
        try {
          return document.querySelector(selector);
        } catch {
          return false;
        }
      });

    const getVideoState = () => {
      const video = document.querySelector("video");
      if (!video) return null;
      return {
        currentTime: video.currentTime,
        duration: video.duration,
        muted: video.muted,
        paused: video.paused,
        playbackRate: video.playbackRate,
        src: video.currentSrc || video.src || "",
      };
    };

    const updateDebugState = () => {
      debugState = {
        active: true,
        enabled,
        recoveryRequested,
        matchedPlayerAdMarkers: getMatches(playerAdMarkers),
        matchedSkipSelectors: getMatches(skipSelectors),
        matchedAntiBlockSelectors: getMatches(antiBlockSelectors),
        sanitizedPlayerResponses,
        video: getVideoState(),
        location: window.location.href || "",
        updatedAt: Date.now(),
      };
      return debugState;
    };

    const renderDebugPanel = () => {
      if (!debugEnabled) return;
      const state = updateDebugState();
      const cleanTitle = (document.title || "").replace(
        /^PakeAdblock (ON|OFF) \| /,
        "",
      );
      document.title = `PakeAdblock ${state.enabled ? "ON" : "OFF"} | ${cleanTitle}`;
      if (!debugPanel) {
        debugPanel = document.createElement("pre");
        debugPanel.id = "pake-youtube-adblock-debug";
        debugPanel.style = debugPanel.style || {};
        debugPanel.style.cssText = [
          "position:fixed",
          "right:12px",
          "top:72px",
          "z-index:2147483647",
          "max-width:420px",
          "max-height:280px",
          "overflow:auto",
          "padding:10px",
          "border-radius:8px",
          "background:rgba(0,0,0,.86)",
          "color:#00ff88",
          "font:12px/1.35 monospace",
          "white-space:pre-wrap",
          "pointer-events:none",
        ].join(";");
        document.documentElement.appendChild(debugPanel);
      }
      debugPanel.textContent = [
        "Pake YouTube adblock diagnostics",
        `enabled: ${state.enabled}`,
        `recoveryRequested: ${state.recoveryRequested}`,
        `player markers: ${state.matchedPlayerAdMarkers.join(", ") || "none"}`,
        `skip buttons: ${state.matchedSkipSelectors.join(", ") || "none"}`,
        `anti-block: ${state.matchedAntiBlockSelectors.join(", ") || "none"}`,
        `sanitized player responses: ${state.sanitizedPlayerResponses}`,
        `video: ${state.video ? `${state.video.currentTime}/${state.video.duration} muted=${state.video.muted} paused=${state.video.paused}` : "none"}`,
      ].join("\n");
    };

    const clean = () => {
      if (!enabled) return;
      if (
        antiBlockSelectors.some((selector) => document.querySelector(selector))
      ) {
        recover("anti-adblock");
        return;
      }

      for (const selector of selectors) {
        querySelectorAllSafe(selector).forEach((node) => node.remove());
      }
      removeSponsoredTextAds();
      for (const selector of skipSelectors) {
        querySelectorAllSafe(selector).forEach((button) => {
          button.click?.();
          if (typeof MouseEvent !== "undefined") {
            button.dispatchEvent?.(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
              }),
            );
          }
        });
      }

      const player = document.querySelector(".html5-video-player.ad-showing");
      const hasPlayerAd = playerAdMarkers.some((selector) =>
        document.querySelector(selector),
      );
      const video =
        player?.querySelector("video") ||
        (hasPlayerAd ? document.querySelector("video") : null);
      if (video) {
        video.muted = true;
        if (video.paused) {
          video.play?.().catch?.(() => {});
        }
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        } else {
          video.playbackRate = 16;
        }
      }
    };

    let stalledSince = null;
    let lastAdTime = null;

    const checkPlaybackStall = (now = Date.now()) => {
      if (!enabled) {
        stalledSince = null;
        lastAdTime = null;
        return;
      }

      const player = document.querySelector(".html5-video-player.ad-showing");
      const video = player?.querySelector("video");
      if (!video || video.paused) {
        stalledSince = null;
        lastAdTime = null;
        return;
      }

      if (lastAdTime === null || video.currentTime !== lastAdTime) {
        lastAdTime = video.currentTime;
        stalledSince = now;
        return;
      }

      if (stalledSince !== null && now - stalledSince >= 15_000) {
        recover("ad-playback-stall");
      }
    };

    const runMaintenance = () => {
      clean();
      checkPlaybackStall();
      renderDebugPanel();
    };

    const style = document.createElement("style");
    style.id = "pake-youtube-adblock-style";
    style.textContent = buildStyleText();
    document.documentElement.appendChild(style);

    let timer;
    const scheduleClean = () => {
      clearTimeout(timer);
      timer = setTimeout(clean, 50);
    };
    new MutationObserver(scheduleClean).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.pakeAdblock = {
      isEnabled: () => enabled,
      setEnabled(nextEnabled) {
        enabled = Boolean(nextEnabled);
        if (enabled) {
          sessionStorage.removeItem(disabledKey);
          sessionStorage.removeItem(recoveryKey);
          recoveryRequested = false;
        } else {
          sessionStorage.setItem(disabledKey, "1");
        }
        style.textContent = enabled ? buildStyleText() : "";
        if (enabled) clean();
      },
      recover,
      checkPlaybackStall,
      getDebugState: updateDebugState,
    };
    patchFetch();
    patchXmlHttpRequest();
    clean();
    renderDebugPanel();
    setInterval(runMaintenance, 250);
    window[loadedKey] = true;

    return true;
  };

  const tryStart = () => {
    try {
      return start();
    } catch (error) {
      started = false;
      delete window[loadedKey];
      return false;
    }
  };

  if (!tryStart()) setInterval(tryStart, 250);
})();
