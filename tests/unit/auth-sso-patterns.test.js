import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// In the order window.rs injects them: link_policy.js defines getRootDomain.
function loadAuthHelpers() {
  const read = (name) =>
    fs.readFileSync(
      path.join(process.cwd(), "src-tauri/src/inject", name),
      "utf-8",
    );

  const context = {
    console,
    URL,
    window: {
      location: { href: "https://example.com/app" },
    },
  };

  context.globalThis = context;
  runInNewContext(read("link_policy.js") + "\n" + read("auth.js"), context);
  return context.window;
}

describe("auth SSO patterns", () => {
  const { isAuthLink, isAuthPopup } = loadAuthHelpers();

  it("matches enterprise SSO providers and endpoints", () => {
    expect(isAuthLink("https://mycompany.okta.com/app/sign-on")).toBe(true);
    expect(isAuthLink("https://acme.onelogin.com/login")).toBe(true);
    expect(isAuthLink("https://idp.example.com/saml/acs")).toBe(true);
    expect(isAuthLink("https://idp.example.com/sso/redirect")).toBe(true);
    expect(isAuthLink("https://fs.example.com/adfs/ls/?wa=wsignin1.0")).toBe(
      true,
    );
  });

  it("still matches the original OAuth providers", () => {
    expect(isAuthLink("https://accounts.google.com/o/oauth2/auth")).toBe(true);
    expect(isAuthLink("https://login.microsoftonline.com/common")).toBe(true);
  });

  it("does not flag ordinary application URLs", () => {
    expect(isAuthLink("https://example.com/dashboard")).toBe(false);
    expect(isAuthLink("https://example.com/reports/q3")).toBe(false);
  });

  it("does not flag ordinary pages that merely contain sso or saml in the path", () => {
    expect(isAuthLink("https://app.example.com/settings/sso/providers")).toBe(
      false,
    );
    expect(isAuthLink("https://app.example.com/docs/saml/overview")).toBe(
      false,
    );
  });

  it("does not flag a query string that carries an SSO URL", () => {
    expect(
      isAuthLink(
        "https://app.example.com/?next=https://idp.example.com/sso/saml",
      ),
    ).toBe(false);
  });

  it("does not flag look-alike provider suffix hosts", () => {
    expect(isAuthLink("https://okta.com.evil.test/app")).toBe(false);
  });

  it("treats known auth window names as popups", () => {
    expect(isAuthPopup("https://example.com/dashboard", "oauth2")).toBe(true);
  });

  it.each([
    "https://outside.example/track?next=https://service.example/login",
    "https://outside.example/track?next=https://accounts.google.com/o/oauth2/auth",
    "https://outside.example/article#/signin",
    "https://outside.example/login-tips",
    "https://outside.example/authorize-your-team",
    "https://accounts.google.com.evil.test/article",
    "https://notaccounts.google.com/article",
  ])(
    "does not infer authentication from ordinary external content: %s",
    (url) => {
      expect(isAuthLink(url)).toBe(false);
      expect(isAuthPopup(url, "_blank")).toBe(false);
    },
  );

  it.each([
    "https://slack.com/openid/connect/authorize?client_id=123",
    "https://identity.example/connect/authorize?client_id=pake&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback",
    "https://tenant.auth0.com/u/login/identifier?returnTo=https%3A%2F%2Fapp.example.com%2Fhome",
    "https://www.amazon.com/ap/signin?openid.mode=checkid_setup&openid.return_to=https%3A%2F%2Fexample.com%2F",
    "https://example.com/tenant/oauth/authorize",
    "https://example.com/login?next=/dashboard",
    "https://example.com/signin/",
    "https://example.com/oauth/authorize",
    "https://example.com/api/auth/signin/google",
    "https://accounts.google.co.uk/ServiceLogin",
    "https://github.com/login/oauth/authorize?client_id=1",
    "https://idp.example/saml/sso/login?SAMLRequest=abc&RelayState=1",
    "https://xyz.supabase.co/auth/v1/authorize?provider=github&code_challenge=x&code_challenge_method=s256",
    "https://fs.corp.test/adfs/ls/idpinitiatedsignon.aspx?loginToRp=urn:app",
    "https://idp.corp.test/adfs/ls/?wa=wsignin1.0&wreply=https%253A%252F%252Fapp.example.com%252F",
    "https://www.facebook.com/v18.0/dialog/oauth?app_id=1",
    "https://appleid.apple.com/auth/authorize",
  ])("preserves authentication endpoints: %s", (url) => {
    expect(isAuthLink(url)).toBe(true);
  });

  // Outlook opens every link in a mail through window.open with noopener; a
  // link to another site's sign-in page went on in the app (2026-11-23).
  it.each([
    "https://github.com/login",
    "https://identity.example/connect/authorize",
    "https://tenant.auth0.com/u/login/identifier",
    "https://www.amazon.com/ap/signin",
    "https://idp.corp.test/saml/sso",
    "https://www.okta.com/blog/",
    "https://okta.com/login",
    "https://www.onelogin.com/login",
    "https://appleid.apple.com/",
    "https://appleid.apple.com/account/manage",
    "https://www.facebook.com/dialog/share?app_id=1&href=https%3A%2F%2Fnews.test%2F",
    "https://service.example/auth/verify?token=abc",
    "https://service.example/login?next=/settings",
    "https://service.example/signin?email=reader%40example.org",
    "https://service.example/oauth/authorize?return=https%3A%2F%2Fother.example%2F",
  ])(
    "sends another site's sign-in page in a link to the browser: %s",
    (url) => {
      expect(isAuthLink(url)).toBe(false);
      expect(isAuthPopup(url, "_blank")).toBe(false);
    },
  );

  it("compares sites by the same root domain as the link policy", () => {
    const helpers = loadAuthHelpers();
    helpers.location.href = "https://app.example.co.uk/home";
    expect(helpers.isAuthLink("https://other.co.uk/login")).toBe(false);
    expect(helpers.isAuthLink("https://id.example.co.uk/login")).toBe(true);
  });

  it("counts the configured site as this site", () => {
    const helpers = loadAuthHelpers();
    helpers.location.href = "https://outlook.live.com/mail/0/";
    helpers.pakeConfig = { url: "https://outlook.live.com/" };
    expect(helpers.isAuthLink("https://account.live.com/auth/verify")).toBe(
      true,
    );
    expect(helpers.isAuthLink("https://github.com/login")).toBe(false);
    expect(
      helpers.isAuthLink(
        "https://idp.example/login?return_to=https%3A%2F%2Foutlook.live.com%2Fmail",
      ),
    ).toBe(true);
  });
});
