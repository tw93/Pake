(function () {
  "use strict";

  // Visual ad-related selectors on Spotify's web player.
  const AD_SELECTORS = [
    '[data-testid="ad-placeholder"]',
    '[data-testid="ad-banner"]',
    '[data-testid="ad-label"]',
    ".AdsContainer",
    ".ads-container",
    ".audio-ad-badge",
    ".ad-banner",
    ".main-adSlot",
    '[aria-label*="Advertisement"]',
    '[aria-label*="Sponsor"]',
  ];

  function hideAds() {
    AD_SELECTORS.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          el.style.display = "none";
          el.style.visibility = "hidden";
          el.style.opacity = "0";
        });
      } catch (e) {
        // Ignore invalid selectors
      }
    });
  }

  const observer = new MutationObserver(hideAds);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  hideAds();

  // Best-effort audio ad mitigation: when an ad label is visible,
  // mute the currently playing audio/video element.
  setInterval(() => {
    const adLabel = document.querySelector('[data-testid="ad-label"]');
    const mediaElements = document.querySelectorAll("audio, video");
    mediaElements.forEach((media) => {
      if (adLabel) {
        if (!media.muted) {
          media.muted = true;
          media.dataset.adMuted = "true";
        }
      } else if (media.dataset.adMuted === "true") {
        media.muted = false;
        delete media.dataset.adMuted;
      }
    });
  }, 1000);
})();
