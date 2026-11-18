// Subframes do not receive the main page's Tauri/event injection on WebKit.
// Forward only known external destinations; native internal/auth/blank popup
// behavior, including its WindowProxy return value, stays with the frame.
(function () {
  if (window === window.top) return;
  const config = window.pakeConfig || {};
  const isInternalUrl = createInternalUrlMatcher(config.internal_url_regex);
  const originalOpen = window.open;

  function externalDestination(rawUrl, name) {
    if (config.force_internal_navigation === true) return null;
    if (
      typeof rawUrl !== "string" ||
      !rawUrl.trim() ||
      rawUrl.trim().startsWith("#")
    ) {
      return null;
    }
    try {
      const url = new URL(rawUrl, document.baseURI);
      if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
        return null;
      if (window.isAuthPopup(url.href, name)) return null;
      if (isInternalUrl(url.href, config.url)) return null;
      return url.href;
    } catch (error) {
      return null;
    }
  }

  function forward(url) {
    window.top.postMessage({ type: "pake:frame-external-link", url }, "*");
  }

  // A frame's own sized sign-in popup (Google's button is such a frame) needs
  // the same real window as the main page's, with this frame as its opener.
  function popupDestination(rawUrl, name, specs) {
    if (!opensSignInPopups() || !requestsPopupWindow(name, specs)) return null;
    const raw = String(rawUrl ?? "").trim();
    if (!raw || raw.startsWith("#")) return null;
    try {
      const url = new URL(raw, document.baseURI);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      if (window.isAuthPopup(url.href, name)) return url.href;
      if (config.new_window !== true && isInternalUrl(url.href, config.url))
        return url.href;
    } catch (error) {
      return null;
    }
    return null;
  }

  window.open = function (url, name, specs) {
    url = normalizePopupUrl(url);
    const popupUrl = popupDestination(url, name, specs);
    if (popupUrl) {
      const popup = openPopupThroughBlank(
        originalOpen,
        window,
        popupUrl,
        name,
        specs,
      );
      if (popup) return popup;
    }
    // Named targets can navigate an existing frame and must retain its proxy.
    if (name && String(name).toLowerCase() !== "_blank") {
      return originalOpen.call(window, url, name, specs);
    }
    const external = externalDestination(url, name);
    if (!external) return originalOpen.call(window, url, name, specs);
    forward(external);
    return null;
  };

  window.addEventListener("click", (event) =>
    handleProtocolLinkClick(event, forward),
  );

  document.addEventListener(
    "click",
    (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      // Named browsing contexts may be part of the page's own frame layout.
      if (anchor.target && !["_blank", "_new", "_self"].includes(anchor.target))
        return;
      const external = externalDestination(anchor.getAttribute("href"), "");
      if (!external || /^(mailto|tel):/.test(external)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      forward(external);
    },
    true,
  );
})();
