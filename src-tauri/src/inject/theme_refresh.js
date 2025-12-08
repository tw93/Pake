document.addEventListener("DOMContentLoaded", () => {
  // Helper: Calculate brightness from RGB color
  const isDarkColor = (color) => {
    if (!color) return false;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Standard luminance formula
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 128;
  };

  // Debounce helper
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Function to detect and send theme to Rust
  const updateTheme = () => {
    let mode = "light";
    let detected = false;

    // Strategy 1: Explicit DOM Class/Attribute (High Priority)
    // Many apps use specific classes for hard-coded themes
    const doc = document.documentElement;
    const body = document.body;

    const isExplicitDark =
      doc.classList.contains("dark") ||
      body.classList.contains("dark") ||
      doc.getAttribute("data-theme") === "dark" ||
      body.getAttribute("data-theme") === "dark" ||
      doc.style.colorScheme === "dark";

    const isExplicitLight =
      doc.classList.contains("light") ||
      body.classList.contains("light") ||
      doc.getAttribute("data-theme") === "light" ||
      body.getAttribute("data-theme") === "light" ||
      doc.style.colorScheme === "light";

    if (isExplicitDark) {
      mode = "dark";
      detected = true;
    } else if (isExplicitLight) {
      mode = "light";
      detected = true;
    }

    // Strategy 2: Computed Background Color (Fallback & Verification)
    // If no explicit class is found, or to double-check, look at the actual background color.
    // This is useful when the site relies purely on CSS media queries without classes.
    if (!detected) {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const htmlBg = window.getComputedStyle(
        document.documentElement,
      ).backgroundColor;

      // Check body first, then html
      if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") {
        mode = isDarkColor(bodyBg) ? "dark" : "light";
      } else if (
        htmlBg &&
        htmlBg !== "rgba(0, 0, 0, 0)" &&
        htmlBg !== "transparent"
      ) {
        mode = isDarkColor(htmlBg) ? "dark" : "light";
      } else {
        // Strategy 3: System Preference (Last Resort)
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
          mode = "dark";
        }
      }
    }

    // Send to Rust
    if (window.__TAURI__ && window.__TAURI__.core) {
      window.__TAURI__.core.invoke("update_theme_mode", { mode });
    }
  };

  // Debounced version of updateTheme
  const debouncedUpdateTheme = debounce(updateTheme, 200);

  // Initial check
  // Delay slightly to ensure styles are applied
  setTimeout(updateTheme, 100);

  // Watch for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", updateTheme);

  // Watch for DOM changes
  // We observe attributes for class changes, and also style changes just in case
  const observer = new MutationObserver((mutations) => {
    debouncedUpdateTheme();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
    subtree: false,
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
    subtree: false,
  });
});
