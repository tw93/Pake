(function () {
  "use strict";

  // Known YouTube ad-related selectors. YouTube changes these frequently,
  // so this is a best-effort list that may need updating.
  const AD_SELECTORS = [
    "#masthead-ad",
    "ytd-ad-slot-renderer",
    "ytd-rich-item-renderer[is-ad]",
    "ytd-video-masthead-ad-advertiser-info-renderer",
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    "ytd-banner-promo-renderer",
    ".ytd-ad-slot-renderer",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-progress-list",
    ".ytp-ad-text",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".video-ads",
    ".ytp-ad-action-interstitial",
    "#player-ads",
    ".ytp-ad-overlay-slot",
    'ytd-popup-container:has(a[href*="google.com/policies/technologies/ads"])',
    "tp-yt-paper-dialog:has(#consent-bump)",
    "ytd-consent-bump-v2-renderer",
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
        // Ignore invalid selectors (e.g. :has on older browsers)
      }
    });
  }

  const observer = new MutationObserver(hideAds);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  hideAds();

  // Auto-click the skip button when it appears.
  setInterval(() => {
    const skipButton = document.querySelector(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button",
    );
    if (skipButton) {
      skipButton.click();
    }
  }, 1000);
})();
