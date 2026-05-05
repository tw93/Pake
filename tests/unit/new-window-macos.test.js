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

    // The fix for #1194 unifies all platforms behind open_requested_window so
    // popups never reuse the opener WKWebViewConfiguration. Guard against
    // accidental reintroduction of NewWindowResponse::Allow which crashes
    // macOS 26 with WKUserContentController duplicate handler errors.
    expect(newWindowBlock).toContain("open_requested_window");
    expect(newWindowBlock).toContain("NewWindowResponse::Create");
    expect(newWindowBlock).not.toMatch(/NewWindowResponse::Allow\b/);
    expect(newWindowBlock).not.toMatch(/#\[cfg\(target_os = "macos"\)\]/);
  });

  it("does not clone the opener WKWebViewConfiguration on macOS popup features", () => {
    // The popup-features handler in build_window must never call
    // .with_webview_configuration(features.opener().target_configuration)
    // because the cloned configuration carries the parent's
    // WKScriptMessageHandler set, which WebKit refuses to register twice and
    // aborts the process on macOS 26.
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).not.toContain("with_webview_configuration");
    expect(source).not.toContain("target_configuration.clone()");
  });
});
