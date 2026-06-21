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

  it("treats known auth window names as popups", () => {
    expect(isAuthPopup("https://example.com/dashboard", "oauth2")).toBe(true);
  });
});
