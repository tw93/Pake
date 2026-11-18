// Shared by the main page and the lightweight subframe bridge.
// Tauri rejects WebKit's empty popup URL before calling our native handler.
function normalizePopupUrl(url) {
  return url === undefined || (typeof url === "string" && !url.trim())
    ? "about:blank"
    : url;
}

// A window.open call that asks for a sized window is a flow the page means to
// finish through window.opener: the popup signs in, hands the result back and
// closes itself. Navigating the opener there instead leaves the callback page
// with nobody to answer, which is the blank window after a Google sign-in.
function requestsPopupWindow(name, specs) {
  if (typeof specs !== "string") return false;
  if (["_self", "_top", "_parent"].includes(String(name || "").toLowerCase()))
    return false;
  // Features are separated by commas or spaces, and "width = 500" is one.
  const features = new Map(
    specs
      .replace(/\s*=\s*/g, "=")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((feature) => {
        const [key, value = ""] = feature.split("=");
        return [key.toLowerCase(), value.toLowerCase()];
      }),
  );
  const enabled = (key) =>
    features.has(key) && !["0", "no", "false"].includes(features.get(key));
  // Without an opener the popup cannot be handed its address afterwards.
  if (enabled("noopener") || enabled("noreferrer")) return false;
  // An explicit popup feature decides; a size asks for a popup otherwise.
  if (features.has("popup")) return enabled("popup");
  return ["width", "height", "innerwidth", "innerheight"].some(
    (key) => parseFloat(features.get(key)) > 0,
  );
}

// WebKitGTK keeps its previous routes: a popup there that closes itself has
// not been run on a real desktop yet, and Wry tears its web view down at once.
function opensSignInPopups() {
  const platform =
    typeof navigator === "undefined"
      ? ""
      : navigator.userAgentData?.platform ||
        navigator.platform ||
        navigator.userAgent ||
        "";
  return !/linux/i.test(platform);
}

// The native handler builds a blank popup under every setting and on every
// platform, with its opener and Pake's download delegate; a popup that starts
// at its address exists only with --new-window. So a sign-in popup starts
// blank and is sent to its address, the two-stage form sites use themselves.
function openPopupThroughBlank(nativeOpen, opener, url, name, specs) {
  const popup = nativeOpen.call(opener, "about:blank", name, specs);
  if (!popup) return null;
  try {
    popup.location.href = url;
  } catch (error) {
    console.error("[Pake] Failed to send a popup to its address:", error);
    try {
      popup.close();
    } catch (closeError) {
      // The caller falls back to its previous route either way.
    }
    return null;
  }
  return popup;
}

// This list intentionally preserves Pake's existing domain routing policy.
const MULTI_PART_PUBLIC_SUFFIXES = [
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "ne.jp",
  "or.jp",
  "co.kr",
  "co.in",
  "com.br",
  "com.cn",
  "com.tw",
  "com.hk",
  "com.sg",
  "github.io",
  "gitlab.io",
  "pages.dev",
];

function getRootDomain(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  if (!normalized) return "";
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 1) return normalized;
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_PUBLIC_SUFFIXES.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function createInternalUrlMatcher(pattern) {
  let regex = null;
  if (pattern) {
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      console.error("[Pake] Invalid internal_url_regex pattern:", error);
    }
  }
  return (url, baseUrl) => {
    if (regex) return regex.test(url);
    try {
      const target = new URL(url);
      const current = new URL(baseUrl);
      return (
        target.hostname === current.hostname ||
        getRootDomain(target.hostname) === getRootDomain(current.hostname)
      );
    } catch (error) {
      return false;
    }
  };
}

// Protocol links may represent a web app's compose/contact menu. Let target
// and document handlers cancel them before falling back to the system app.
function handleProtocolLinkClick(event, openExternal) {
  if (event.defaultPrevented) return;
  const anchor = event.target?.closest?.("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return;
  if (anchor.target && !["_blank", "_new", "_self"].includes(anchor.target))
    return;
  if (typeof anchor.href !== "string" || !/^(mailto|tel):/i.test(anchor.href))
    return;
  const url = new URL(anchor.href);
  if (window.pakeConfig?.force_internal_navigation) return;
  if (
    createInternalUrlMatcher(window.pakeConfig?.internal_url_regex)(
      url.href,
      window.pakeConfig?.url || window.location.href,
    )
  )
    return;
  event.preventDefault();
  openExternal(url.href);
}
