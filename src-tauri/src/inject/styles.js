(function () {
  const INJECT_STYLE_KEY = "__PAKE_INJECT_STYLE__";
  const adoptedSheetsById = new Map();

  if (typeof window[INJECT_STYLE_KEY] === "function") {
    return;
  }

  function injectWithAdoptedStyleSheet(css, id) {
    try {
      if (
        typeof window.CSSStyleSheet !== "function" ||
        !("adoptedStyleSheets" in document) ||
        /^\s*@import\b/m.test(css)
      ) {
        return null;
      }

      const currentSheets = document.adoptedStyleSheets;
      const sheet = new window.CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = Array.from(currentSheets).concat(sheet);

      if (!Array.from(document.adoptedStyleSheets).includes(sheet)) {
        return null;
      }

      if (id) {
        adoptedSheetsById.set(id, sheet);
      }
      return sheet;
    } catch (_error) {
      return null;
    }
  }

  window[INJECT_STYLE_KEY] = function (css, id) {
    if (id) {
      const existingElement = document.getElementById(id);
      if (existingElement) {
        return existingElement;
      }

      const existingSheet = adoptedSheetsById.get(id);
      if (existingSheet) {
        try {
          if (Array.from(document.adoptedStyleSheets).includes(existingSheet)) {
            return existingSheet;
          }
        } catch (_error) {
          // Recreate the sheet when the document's adopted-sheet list is unavailable.
        }
        adoptedSheetsById.delete(id);
      }
    }

    const sheet = injectWithAdoptedStyleSheet(css, id);
    if (sheet) {
      return sheet;
    }

    const style = document.createElement("style");
    if (id) {
      style.id = id;
    }
    style.textContent = css;
    (document.head || document.body || document.documentElement)?.appendChild(
      style,
    );
    return style;
  };
})();
