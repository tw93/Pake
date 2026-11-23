// Xiaohongshu's creator platform, creator.xiaohongshu.com, is a separate site
// the app opens in place of the notes, and nothing on it leads back to them:
// a user who opened it found no way home. Its Xiaohongshu logo, top left with
// the platform's name, now goes back to the home page.
(() => {
  if (location.hostname !== "creator.xiaohongshu.com") return;
  const HOME = "https://www.xiaohongshu.com/explore";
  const MARK = "pakeHome";

  // The logo is the header's first svg; its group is the nearest ancestor that
  // also holds the platform's name. Class names are generated, so none is used.
  const findLogo = () => {
    for (const svg of document.querySelectorAll("svg")) {
      const box = svg.getBoundingClientRect();
      if (box.width === 0 || box.top > 80 || box.left > 160) continue;
      for (
        let group = svg.parentElement, depth = 0;
        group && depth < 4;
        group = group.parentElement, depth++
      ) {
        const width = group.getBoundingClientRect().width;
        if (width > 420) break;
        if (group.textContent.includes("创作服务平台")) return group;
      }
      return svg.parentElement;
    }
    return null;
  };

  let marked = null;
  const mark = () => {
    if (marked?.isConnected) return;
    const logo = findLogo();
    if (!logo || logo.dataset[MARK]) return;
    marked = logo;
    logo.dataset[MARK] = "1";
    logo.style.cursor = "pointer";
    logo.addEventListener("click", (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      location.href = HOME;
    });
  };

  const start = () => {
    mark();
    new MutationObserver(mark).observe(document.body, {
      childList: true,
      subtree: true,
    });
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
