import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(process.cwd(), "src-tauri/src/app/window.rs");

describe("macOS new-window handling (regression: #1194)", () => {
  it("creates popups via open_requested_window on every platform", () => {
    const source = fs.readFileSync(sourcePath, "utf-8");

    const blockStart = source.indexOf("if window_config.new_window");
    const blockEnd = source.indexOf(
      "// Add initialization scripts",
      blockStart,
    );
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);

    const newWindowBlock = source.slice(blockStart, blockEnd);

    // Pake must create the popup itself so Wry can install its own delegates
    // and custom protocol state. NewWindowResponse::Allow creates a plain
    // WKWebView that does not have Pake's runtime state.
    expect(newWindowBlock).toContain("open_requested_window");
    expect(newWindowBlock).toContain("NewWindowResponse::Create");
    expect(newWindowBlock).not.toMatch(/NewWindowResponse::Allow\b/);
    expect(newWindowBlock).not.toMatch(/#\[cfg\(target_os = "macos"\)\]/);
  });

  it("uses WebKit's target configuration with a fresh user content controller", () => {
    // WebKit requires createNewPage to return a WKWebView built from the exact
    // target configuration. Reusing its inherited WKUserContentController,
    // however, makes Wry register the `ipc` handler twice. Reset only the
    // controller, then let Tauri consume all opener-provided window features.
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain(
      "prepare_macos_new_window_configuration(&features)?",
    );
    expect(source).toContain("setUserContentController(&controller)");
    expect(source).toContain("window_features(features).focused(true)");
    expect(source).not.toContain("removeAllUserScripts");
    expect(source).not.toContain("removeAllScriptMessageHandlers");
  });

  it("groups only multi-window clones into native macOS tabs", () => {
    const source = fs.readFileSync(sourcePath, "utf-8");

    expect(source).toContain(
      "let use_native_window_tabbing = config.multi_window && new_window_features.is_none();",
    );
    expect(source).toContain(
      'let prefer_native_window_tabbing = use_native_window_tabbing && label != "pake";',
    );
    expect(source).toContain(".tabbing_identifier(&tauri_config.identifier)");
    expect(source).toContain("if prefer_native_window_tabbing");
    expect(source).not.toContain("tabbing_identifier: String");
  });
});
