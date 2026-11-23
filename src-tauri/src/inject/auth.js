// OAuth and Authentication Logic
// link_policy.js runs first in every frame and defines getRootDomain.

// Check if URL matches OAuth/authentication patterns
function matchesAuthUrl(url, baseUrl = window.location.href) {
  // A sign-in path on this site is this site's sign-in. On another site it is
  // one only when the request says so: an OAuth, OpenID, SAML or WS-Federation
  // parameter, or a return address on this site. A link in a mail or a post to
  // another site's /login, /auth/verify or /signin page carries neither and
  // opens in the browser like any other link (Outlook, 2026-11-23). The
  // helpers stay inside this function so a page never sees or replaces them.
  const signInParams = [
    "client_id",
    "redirect_uri",
    "response_type",
    "code_challenge",
    "samlrequest",
    "samlresponse",
    "relaystate",
    "wtrealm",
    "wreply",
    "logintorp",
    "openid.mode",
    "openid.return_to",
  ];
  const safeDecode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  };
  const asAddress = (value) => {
    for (const text of [value, safeDecode(value)]) {
      try {
        const address = new URL(text);
        if (/^https?:$/.test(address.protocol)) return address;
      } catch (e) {
        // Not an address.
      }
    }
    return null;
  };
  const signsInToThisSite = (target) => {
    const sites = new Set();
    for (const address of [baseUrl, window.pakeConfig?.url]) {
      try {
        if (address) sites.add(getRootDomain(new URL(address).hostname));
      } catch (e) {
        // An unreadable address names no site.
      }
    }
    if (sites.has(getRootDomain(target.hostname))) return true;
    for (const [key, value] of target.searchParams) {
      if (signInParams.includes(key.toLowerCase())) return true;
      const address = asAddress(value);
      if (address && sites.has(getRootDomain(address.hostname))) return true;
    }
    return false;
  };

  try {
    const urlObj = new URL(url, baseUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    // Host patterns never inspect user-controlled query strings or fragments.
    const oauthHostPatterns = [
      /^accounts\.google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/,
      /^login\.microsoftonline\.com$/,
    ];
    // Match complete path segments, including nested identity-provider routes.
    // /login-tips is content; /tenant/login remains an authentication endpoint.
    const oauthPathPatterns = [
      /\/(?:oauth2?|auth|authorize|signin|login|servicelogin)(?:\/|$)/,
    ];
    // Apple's and Facebook's sign-in live under one path on hosts that also
    // serve account pages and share dialogs, which mails link to.
    const providerEndpoint =
      (hostname === "appleid.apple.com" && /^\/auth(?:\/|$)/.test(pathname)) ||
      (/^(?:www\.)?facebook\.com$/.test(hostname) &&
        /^\/(?:[^/]+\/)?dialog\/oauth(?:\/|$)/.test(pathname));

    // Enterprise SSO. Match identity providers on the host, and SAML/SSO/ADFS on
    // the pathname with endpoint-shaped patterns only, so ordinary pages such as
    // /settings/sso/providers (or a query string carrying an SSO URL) are not
    // misread as authentication.
    // A tenant's own subdomain, never the vendors' own websites.
    const enterpriseHostPatterns = [
      /^(?!www\.)[a-z0-9-]+\.okta\.com$/,
      /^(?!www\.)[a-z0-9-]+\.onelogin\.com$/,
    ];
    const enterprisePathPatterns = [
      /\/saml2?\/(sso|acs|login|metadata|consume|redirect|callback|continue)/,
      /\/sso\/(saml|oidc|oauth|login|authorize|redirect|callback|acs|start|continue|metadata)/,
      /\/adfs\/ls\b/,
    ];

    const providerHost =
      oauthHostPatterns.some((pattern) => pattern.test(hostname)) ||
      providerEndpoint ||
      enterpriseHostPatterns.some((pattern) => pattern.test(hostname));
    const signInPath =
      oauthPathPatterns.some((pattern) => pattern.test(pathname)) ||
      enterprisePathPatterns.some((pattern) => pattern.test(pathname));

    const isMatch = providerHost || (signInPath && signsInToThisSite(urlObj));

    if (isMatch) {
      console.log("[Pake] OAuth URL detected:", url);
    }

    return isMatch;
  } catch (e) {
    return false;
  }
}

// Check if URL is an OAuth/authentication link
function isAuthLink(url) {
  return matchesAuthUrl(url);
}

// Check if this is an OAuth/authentication popup
function isAuthPopup(url, name) {
  // Check for known authentication window names
  const authWindowNames = [
    "AppleAuthentication",
    "oauth2",
    "oauth",
    "google-auth",
    "auth-popup",
    "signin",
    "login",
  ];

  if (authWindowNames.includes(name)) {
    return true;
  }

  return matchesAuthUrl(url);
}

// Export functions to global scope
window.matchesAuthUrl = matchesAuthUrl;
window.isAuthLink = isAuthLink;
window.isAuthPopup = isAuthPopup;
