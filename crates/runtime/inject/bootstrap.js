// WebPake inject bootstrap - loaded into every page via initializationScript.
// Member C maintains this file; Member A provides Tauri Commands it may call.

(function () {
  "use strict";

  const config = window.__WEBPAKE__ || {};

  // --- Custom CSS ---
  if (config.customCss) {
    const style = document.createElement("style");
    style.textContent = config.customCss;
    document.head.appendChild(style);
  }

  // --- Ad blocking ---
  if (config.blockAds) {
    const adSelectors = [
      "[class*='ad-']",
      "[id*='ad-']",
      "[class*='advert']",
      "[class*='sponsor']",
      "iframe[src*='doubleclick']",
      "iframe[src*='googlesyndication']",
      ".ytp-ad-module",
      "#masthead-ad",
    ];
    const style = document.createElement("style");
    style.textContent = adSelectors.map((s) => `${s}{display:none!important}`).join("");
    document.head.appendChild(style);
  }

  // --- Clipboard bridge (Linux/Windows) ---
  if (config.clipboardBridge && !/Mac/.test(navigator.platform)) {
    document.addEventListener(
      "keydown",
      (event) => {
        if (!event.ctrlKey || event.metaKey || !event.isTrusted) return;
        const key = event.key.toLowerCase();
        const target = event.target;
        const editable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable);

        if (key === "c" && editable) {
          document.execCommand("copy");
          event.preventDefault();
        } else if (key === "x" && editable) {
          document.execCommand("cut");
          event.preventDefault();
        } else if (key === "a" && editable) {
          document.execCommand("selectAll");
          event.preventDefault();
        }
        // Ctrl+V: let native paste handle images/files
      },
      true
    );
  }

  // --- OAuth popup inline ---
  if (config.inlineAuthPopups) {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      if (url && typeof url === "string") {
        const authHosts = [
          "accounts.google.com",
          "appleid.apple.com",
          "login.live.com",
          "github.com/login",
          "login.microsoftonline.com",
        ];
        const isAuth = authHosts.some((host) => url.includes(host));
        if (isAuth && target !== "AppleAuthentication") {
          window.location.href = url;
          return null;
        }
      }
      return originalOpen.call(window, url, target, features);
    };
  }

  // --- External links ---
  if (config.openExternalLinksInBrowser) {
    document.addEventListener(
      "click",
      (event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a") : null;
        if (!anchor || !anchor.href) return;
        try {
          const link = new URL(anchor.href);
          const current = new URL(window.location.href);
          if (link.origin !== current.origin && anchor.target !== "_self") {
            event.preventDefault();
            if (window.__TAURI__?.opener?.openUrl) {
              window.__TAURI__.opener.openUrl(anchor.href);
            } else {
              window.open(anchor.href, "_blank");
            }
          }
        } catch (_) {
          /* ignore malformed URLs */
        }
      },
      true
    );
  }

  // --- Multi-window link handling ---
  if (config.multiWindow) {
    document.addEventListener(
      "click",
      (event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a") : null;
        if (!anchor || anchor.target !== "_blank") return;
        event.preventDefault();
        if (window.__TAURI__?.core?.invoke) {
          window.__TAURI__.core
            .invoke("open_new_window", { url: anchor.href })
            .catch(() => window.open(anchor.href, "_blank"));
        } else {
          window.open(anchor.href, "_blank");
        }
      },
      true
    );
  }

  console.info("[WebPake] inject loaded");
})();
