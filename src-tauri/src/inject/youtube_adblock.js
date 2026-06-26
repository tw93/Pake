(() => {
  const config = window.pakeConfig?.adblock;
  const supportedHosts = new Set(["www.youtube.com", "m.youtube.com"]);
  if (!config?.enabled || config.profile !== "youtube") return;
  if (!supportedHosts.has(window.location.hostname)) return;

  const recoveryKey = "pake-youtube-adblock-recovered";
  const disabledKey = "pake-youtube-adblock-disabled";
  let recoveryRequested = sessionStorage.getItem(recoveryKey) === "1";
  let enabled = sessionStorage.getItem(disabledKey) !== "1";
  const selectors = [
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-in-feed-ad-layout-renderer",
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

  const clean = () => {
    if (!enabled) return;
    if (
      antiBlockSelectors.some((selector) => document.querySelector(selector))
    ) {
      recover("anti-adblock");
      return;
    }

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }
    for (const selector of skipSelectors) {
      document.querySelectorAll(selector).forEach((button) => button.click?.());
    }

    const player = document.querySelector(".html5-video-player.ad-showing");
    const hasPlayerAd = playerAdMarkers.some((selector) =>
      document.querySelector(selector),
    );
    const video =
      player?.querySelector("video") ||
      (hasPlayerAd ? document.querySelector("video") : null);
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      video.muted = true;
      video.currentTime = video.duration;
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
  };

  const style = document.createElement("style");
  style.id = "pake-youtube-adblock-style";
  style.textContent = `${selectors.join(",")} { display: none !important; }`;
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
      style.textContent = enabled
        ? `${selectors.join(",")} { display: none !important; }`
        : "";
      if (enabled) clean();
    },
    recover,
    checkPlaybackStall,
  };
  clean();
  setInterval(runMaintenance, 1_000);
})();
