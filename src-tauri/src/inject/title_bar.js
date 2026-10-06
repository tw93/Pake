// Injected only on macOS windows with a transparent title bar. The page starts
// below the bar, so this paints the bar with the color along the page's top
// edge and it reads as part of the page rather than a separate strip.
(function () {
  const SAMPLE_POINTS = [0.25, 0.5, 0.75];
  const MIN_ALPHA = 128;
  let probe = null;
  let lastSent = "";
  let pending = 0;
  let warned = false;

  // A 1x1 canvas resolves any CSS color the engine supports (rgb, oklch,
  // color(), named) into sRGB bytes, so modern color syntax is not missed.
  function toRgb(value) {
    if (!value || value === "transparent") return null;
    if (!probe) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      probe = canvas.getContext("2d", { willReadFrequently: true });
      if (!probe) return null;
    }
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "rgba(0, 0, 0, 0)";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = probe.getImageData(0, 0, 1, 1).data;
    return alpha >= MIN_ALPHA ? { red, green, blue } : null;
  }

  function backgroundAt(x) {
    let element = document.elementFromPoint(x, 0);
    while (element) {
      const color = toRgb(window.getComputedStyle(element).backgroundColor);
      if (color) return color;
      element = element.parentElement;
    }
    return null;
  }

  // The most common of three samples along the top edge, so a sidebar or a
  // logo under one sample point does not decide the whole bar.
  function pageTopColor() {
    const width = window.innerWidth;
    if (!width) return null;
    const samples = SAMPLE_POINTS.map((share) =>
      backgroundAt(Math.floor(width * share)),
    );
    const keys = samples.map((color) =>
      color ? `${color.red},${color.green},${color.blue}` : "",
    );
    const majority = keys.findIndex(
      (key, index) => key && keys.indexOf(key, index + 1) !== -1,
    );
    return samples[majority === -1 ? 1 : majority];
  }

  function update() {
    pending = 0;
    const color = pageTopColor();
    if (!color) return;
    const key = `${color.red},${color.green},${color.blue}`;
    if (key === lastSent) return;
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;
    lastSent = key;
    // Pages outside the configured origin have no IPC grant; warn once and
    // keep the last color rather than retrying every interval.
    invoke("set_title_bar_color", color).catch((error) => {
      if (warned) return;
      warned = true;
      console.warn("[Pake] Failed to color the title bar:", error);
    });
  }

  function schedule() {
    if (!pending) pending = setTimeout(update, 150);
  }

  function start() {
    update();
    const observer = new MutationObserver(schedule);
    const attributes = {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    };
    observer.observe(document.documentElement, attributes);
    if (document.body) observer.observe(document.body, attributes);
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);
    window
      .matchMedia?.("(prefers-color-scheme: dark)")
      ?.addEventListener?.("change", schedule);
    // Single-page apps repaint their header without touching html or body.
    setInterval(schedule, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
