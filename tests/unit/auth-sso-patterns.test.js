import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function loadAuthHelpers() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/auth.js"),
    "utf-8",
  );

  const context = {
    console,
    URL,
    window: {
      location: { href: "https://example.com/app" },
    },
  };

  runInNewContext(source, context);
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
    "https://identity.example/connect/authorize",
    "https://tenant.auth0.com/u/login/identifier",
    "https://www.amazon.com/ap/signin",
    "https://example.com/tenant/oauth/authorize",
    "https://example.com/login?next=/dashboard",
    "https://example.com/signin/",
    "https://example.com/oauth/authorize",
    "https://example.com/api/auth/signin/google",
    "https://accounts.google.co.uk/ServiceLogin",
    "https://github.com/login/oauth/authorize",
    "https://appleid.apple.com/auth/authorize",
  ])("preserves authentication endpoints: %s", (url) => {
    expect(isAuthLink(url)).toBe(true);
  });
});
