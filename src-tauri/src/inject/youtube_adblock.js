(() => {
  const config = window.pakeConfig?.adblock;
  const supportedHosts = new Set(["www.youtube.com", "m.youtube.com"]);
  if (!config?.enabled || config.profile !== "youtube") return;
  if (!supportedHosts.has(window.location.hostname)) return;

  let enabled = true;
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

  const clean = () => {
    if (!enabled) return;
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }
    for (const selector of skipSelectors) {
      document.querySelectorAll(selector).forEach((button) => button.click?.());
    }

    const player = document.querySelector(".html5-video-player.ad-showing");
    const video = player?.querySelector("video");
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      video.muted = true;
      video.currentTime = video.duration;
    }
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
      style.textContent = enabled
        ? `${selectors.join(",")} { display: none !important; }`
        : "";
      if (enabled) clean();
    },
  };
  clean();
})();
