import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("macOS new-window handling", () => {
  it("uses the default WebKit popup path instead of manually creating a Tauri window", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src-tauri/src/app/window.rs"),
      "utf-8",
    );

    const blockStart = source.indexOf("if window_config.new_window");
    const blockEnd = source.indexOf(
      "// Add initialization scripts",
      blockStart,
    );
    const newWindowBlock = source.slice(blockStart, blockEnd);

    expect(newWindowBlock).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s*\{\s*window_builder\s*=\s*window_builder\.on_new_window\(\|_target_url, _features\| NewWindowResponse::Allow\);\s*\}/s,
    );

    const macosBranch = newWindowBlock.slice(
      newWindowBlock.indexOf('#[cfg(target_os = "macos")]'),
      newWindowBlock.indexOf('#[cfg(not(target_os = "macos"))]'),
    );

    expect(macosBranch).not.toContain("open_requested_window");
    expect(macosBranch).not.toContain("with_webview_configuration");
  });
});
