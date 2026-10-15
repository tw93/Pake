import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// style.js is injected into every app, including sites users package
// themselves, so site tweaks must only load on their own hosts.
const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/style.js"),
  "utf-8",
);

function injectedStyles(hostname, { mac = true, immersive = true } = {}) {
  const styles = {};
  let onReady;
  runInNewContext(source, {
    navigator: { userAgent: mac ? "Macintosh" : "Windows NT 10.0" },
    hasImmersiveHeader: () => immersive,
    window: {
      location: { hostname },
      pakeConfig: {},
      __PAKE_INJECT_STYLE__: (css, id) => {
        styles[id] = css;
      },
      addEventListener: (type, handler) => {
        if (type === "DOMContentLoaded") onReady = handler;
      },
    },
  });
  onReady();
  return {
    content: styles["pake-content-style"] || "",
    immersive: styles["pake-top-padding-style"] || "",
  };
}

describe("site styles", () => {
  it("gives an unrelated site only the global rules", () => {
    const { content, immersive } = injectedStyles("example.com");

    expect(content).toContain("html::-webkit-scrollbar");
    expect(content).not.toMatch(/#react-root|#__next|\.copyright/);
    expect(immersive).toContain("#pake-top-dom");
    expect(immersive).not.toMatch(/padding-top|margin-left/);
  });

  it("loads a site's rules on its host and subdomains", () => {
    expect(injectedStyles("x.com").content).toContain("#react-root");
    expect(injectedStyles("wx.qq.com").content).toContain(".copyright");
    expect(injectedStyles("music.youtube.com").immersive).toContain(
      "ytmusic-nav-bar",
    );
    expect(injectedStyles("www.notion.so").immersive).toContain(
      ".notion-sidebar",
    );
  });

  it("does not match lookalike hosts", () => {
    expect(injectedStyles("notx.com").content).not.toContain("#react-root");
    expect(injectedStyles("x.com.example.org").content).not.toContain(
      "#react-root",
    );
  });

  it("keeps site immersive spacing to the macOS hidden title bar", () => {
    expect(injectedStyles("chat.deepseek.com").immersive).toContain(
      "._5a20a69",
    );
    expect(
      injectedStyles("chat.deepseek.com", { mac: false }).immersive,
    ).not.toContain("._5a20a69");
    expect(
      injectedStyles("chat.deepseek.com", { immersive: false }).immersive,
    ).toBe("");
  });
});
