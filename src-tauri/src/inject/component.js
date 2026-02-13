document.addEventListener("DOMContentLoaded", () => {
  // Toast
  function pakeToast(msg) {
    const m = document.createElement("div");
    m.innerHTML = msg;
    m.style.cssText =
      "max-width:60%;min-width: 80px;padding:0 12px;height: 32px;color: rgb(255, 255, 255);line-height: 32px;text-align: center;border-radius: 8px;position: fixed; bottom:24px;right: 28px;z-index: 999999;background: rgba(0, 0, 0,.8);font-size: 13px;";
    document.body.appendChild(m);
    setTimeout(function () {
      const d = 0.5;
      m.style.transition =
        "transform " + d + "s ease-in, opacity " + d + "s ease-in";
      m.style.opacity = "0";
      setTimeout(function () {
        document.body.removeChild(m);
      }, d * 1000);
    }, 3000);
  }

  window.pakeToast = pakeToast;
});

// Polyfill for HTML5 Fullscreen API in Tauri webview
// This bridges the HTML5 Fullscreen API to Tauri's native window fullscreen
// Works for all video sites (YouTube, Vimeo, Bilibili, etc.)
(function () {
  if (window.__PAKE_FULLSCREEN_POLYFILL__) return;
  window.__PAKE_FULLSCREEN_POLYFILL__ = true;

  function initFullscreenPolyfill() {
    if (!window.__TAURI__ || !document.head) {
      setTimeout(initFullscreenPolyfill, 100);
      return;
    }

    const appWindow = window.__TAURI__.window.getCurrentWindow();
    let fullscreenElement = null;
    let actualFullscreenElement = null;
    let originalStyles = null;
    let originalParent = null;
    let originalNextSibling = null;
    let wasInBody = false;
    let monitorId = null;

    // Inject fullscreen styles
    if (!document.getElementById("pake-fullscreen-style")) {
      const styleEl = document.createElement("style");
      styleEl.id = "pake-fullscreen-style";
      styleEl.textContent = `
      body.pake-fullscreen-active {
        overflow: hidden !important;
      }
      .pake-fullscreen-element {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 2147483647 !important;
        background: #000 !important;
        object-fit: contain !important;
      }
      .pake-fullscreen-element video {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
      }
    `;
      document.head.appendChild(styleEl);
    }

    function startFullscreenMonitor() {
      if (monitorId) return;
      monitorId = setInterval(() => {
        appWindow
          .isFullscreen()
          .then((isFullscreen) => {
            if (fullscreenElement && !isFullscreen) {
              exitFullscreen();
            }
          })
          .catch(() => {});
      }, 500);
    }

    function stopFullscreenMonitor() {
      if (!monitorId) return;
      clearInterval(monitorId);
      monitorId = null;
    }

    // Find the actual video element
    function findMediaElement() {
      const videos = document.querySelectorAll("video");
      if (videos.length > 0) {
        let largestVideo = videos[0];
        let maxArea = 0;
        videos.forEach((video) => {
          const rect = video.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area > maxArea || !video.paused) {
            maxArea = area;
            largestVideo = video;
          }
        });
        return largestVideo;
      }
      return null;
    }

    // Enter fullscreen
    function enterFullscreen(element) {
      fullscreenElement = element;

      // If html/body element, find the video instead
      let targetElement = element;
      if (element === document.documentElement || element === document.body) {
        const mediaElement = findMediaElement();
        if (mediaElement) {
          targetElement = mediaElement;
          actualFullscreenElement = mediaElement;
        } else {
          actualFullscreenElement = element;
        }
      } else {
        actualFullscreenElement = element;
      }

      // Save original state
      originalStyles = {
        position: targetElement.style.position,
        top: targetElement.style.top,
        left: targetElement.style.left,
        width: targetElement.style.width,
        height: targetElement.style.height,
        maxWidth: targetElement.style.maxWidth,
        maxHeight: targetElement.style.maxHeight,
        margin: targetElement.style.margin,
        padding: targetElement.style.padding,
        zIndex: targetElement.style.zIndex,
        background: targetElement.style.background,
        objectFit: targetElement.style.objectFit,
      };

      wasInBody = targetElement.parentNode === document.body;
      if (!wasInBody) {
        originalParent = targetElement.parentNode;
        originalNextSibling = targetElement.nextSibling;
      }

      // Apply fullscreen
      targetElement.classList.add("pake-fullscreen-element");
      document.body.classList.add("pake-fullscreen-active");

      if (!wasInBody) {
        document.body.appendChild(targetElement);
      }

      // Fullscreen window
      appWindow.setFullscreen(true).then(() => {
        startFullscreenMonitor();
        const event = new Event("fullscreenchange", { bubbles: true });
        document.dispatchEvent(event);
        element.dispatchEvent(event);

        const webkitEvent = new Event("webkitfullscreenchange", {
          bubbles: true,
        });
        document.dispatchEvent(webkitEvent);
        element.dispatchEvent(webkitEvent);
      });

      return Promise.resolve();
    }

    // Exit fullscreen
    function exitFullscreen() {
      if (!fullscreenElement) {
        return Promise.resolve();
      }

      stopFullscreenMonitor();

      const exitingElement = fullscreenElement;
      const targetElement = actualFullscreenElement;

      // Restore styles and position
      targetElement.classList.remove("pake-fullscreen-element");
      document.body.classList.remove("pake-fullscreen-active");

      if (originalStyles) {
        Object.keys(originalStyles).forEach((key) => {
          targetElement.style[key] = originalStyles[key];
        });
      }

      if (!wasInBody && originalParent) {
        if (
          originalNextSibling &&
          originalNextSibling.parentNode === originalParent
        ) {
          originalParent.insertBefore(targetElement, originalNextSibling);
        } else if (originalParent.isConnected) {
          originalParent.appendChild(targetElement);
        }
      }

      // Reset state
      fullscreenElement = null;
      actualFullscreenElement = null;
      originalStyles = null;
      originalParent = null;
      originalNextSibling = null;
      wasInBody = false;

      // Exit window fullscreen
      return appWindow.setFullscreen(false).then(() => {
        const event = new Event("fullscreenchange", { bubbles: true });
        document.dispatchEvent(event);
        exitingElement.dispatchEvent(event);

        const webkitEvent = new Event("webkitfullscreenchange", {
          bubbles: true,
        });
        document.dispatchEvent(webkitEvent);
        exitingElement.dispatchEvent(webkitEvent);
      });
    }

    // Override fullscreenEnabled
    Object.defineProperty(document, "fullscreenEnabled", {
      get: () => true,
      configurable: true,
    });
    Object.defineProperty(document, "webkitFullscreenEnabled", {
      get: () => true,
      configurable: true,
    });

    // Override fullscreenElement
    Object.defineProperty(document, "fullscreenElement", {
      get: () => fullscreenElement,
      configurable: true,
    });
    Object.defineProperty(document, "webkitFullscreenElement", {
      get: () => fullscreenElement,
      configurable: true,
    });
    Object.defineProperty(document, "webkitCurrentFullScreenElement", {
      get: () => fullscreenElement,
      configurable: true,
    });

    // Override requestFullscreen
    Element.prototype.requestFullscreen = function () {
      return enterFullscreen(this);
    };
    Element.prototype.webkitRequestFullscreen = function () {
      return enterFullscreen(this);
    };
    Element.prototype.webkitRequestFullScreen = function () {
      return enterFullscreen(this);
    };

    // Override exitFullscreen
    document.exitFullscreen = exitFullscreen;
    document.webkitExitFullscreen = exitFullscreen;
    document.webkitCancelFullScreen = exitFullscreen;

    // Handle Escape key
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && fullscreenElement) {
          exitFullscreen();
        }
      },
      true,
    );
  }

  initFullscreenPolyfill();
})();
