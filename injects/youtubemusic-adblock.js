(function () {
  'use strict';

  // Known YouTube Music ad-related selectors.
  const AD_SELECTORS = [
    'ytmusic-ad-slot-renderer',
    '.ytmusic-ad-slot-renderer',
    'ytmusic-player-bar-ad-slot',
    'ytmusic-clip-ad-renderer',
    'ytmusic-ad-avatar-renderer',
    'ytmusic-ad-hero-image-renderer',
    'ytmusic-ad-title-renderer',
    'ytmusic-ad-badge-renderer',
  ];

  function hideAds() {
    AD_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      });
    });
  }

  const observer = new MutationObserver(hideAds);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  hideAds();
})();
