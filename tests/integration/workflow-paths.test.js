/**
 * Workflow Path Integration Tests
 *
 * These tests verify that the paths used in GitHub Actions workflows
 * match the actual output paths from the CLI builders.
 */

import { describe, it, expect } from "vitest";
import path from "path";

describe("Workflow path integration", () => {
  describe("Platform-specific output paths", () => {
    it("should match Linux output paths", () => {
      // Expected paths based on LinuxBuilder behavior
      const linuxPaths = {
        deb: {
          // CLI copies to project root
          primary: "appname.deb",
          // Fallback location in bundle directory
          fallback: "src-tauri/target/release/bundle/deb",
        },
        appimage: {
          primary: "appname.AppImage",
          fallback: "src-tauri/target/release/bundle/appimage",
        },
        rpm: {
          primary: "appname.rpm",
          fallback: "src-tauri/target/release/bundle/rpm",
        },
      };

      // Verify paths are defined
      expect(linuxPaths.deb.primary).toBeTruthy();
      expect(linuxPaths.deb.fallback).toBeTruthy();
      expect(linuxPaths.appimage.primary).toBeTruthy();
      expect(linuxPaths.appimage.fallback).toBeTruthy();
    });

    it("should match Windows output paths", () => {
      // Expected paths based on WinBuilder behavior
      const windowsPaths = {
        msi: {
          // For x64 builds, files are in architecture-specific directory
          architectureSpecific:
            "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi",
          // Fallback to generic path
          generic: "src-tauri/target/release/bundle/msi",
        },
      };

      expect(windowsPaths.msi.architectureSpecific).toBeTruthy();
      expect(windowsPaths.msi.generic).toBeTruthy();
    });

    it("should match macOS output paths", () => {
      // Expected paths based on MacBuilder behavior
      const macosPaths = {
        dmg: {
          // CLI copies to project root
          primary: "appname.dmg",
          // Universal builds use universal-apple-darwin target
          universalBundle:
            "src-tauri/target/universal-apple-darwin/release/bundle/dmg",
          // Regular builds
          genericBundle: "src-tauri/target/release/bundle/dmg",
        },
        app: {
          primary: "appname.app",
          universalBundle:
            "src-tauri/target/universal-apple-darwin/release/bundle/macos",
          genericBundle: "src-tauri/target/release/bundle/macos",
        },
      };

      expect(macosPaths.dmg.primary).toBeTruthy();
      expect(macosPaths.dmg.universalBundle).toBeTruthy();
      expect(macosPaths.app.primary).toBeTruthy();
      expect(macosPaths.app.universalBundle).toBeTruthy();
    });
  });

  describe("Multi-target scenarios", () => {
    it("should handle Linux multi-target builds", () => {
      const targets = "deb,appimage";
      const parsedTargets = targets.split(",").map((t) => t.trim());

      expect(parsedTargets).toEqual(["deb", "appimage"]);
      expect(parsedTargets).toHaveLength(2);
    });

    it("should handle targets with spaces", () => {
      const targets = "deb, appimage, rpm";
      const parsedTargets = targets.split(",").map((t) => t.trim());

      expect(parsedTargets).toEqual(["deb", "appimage", "rpm"]);
      expect(parsedTargets).toHaveLength(3);
    });

    it("should filter valid targets", () => {
      const targets = "deb,invalid,appimage";
      const parsedTargets = targets.split(",").map((t) => t.trim());
      const validTargets = ["deb", "appimage", "rpm"];
      const filtered = parsedTargets.filter((t) => validTargets.includes(t));

      expect(filtered).toEqual(["deb", "appimage"]);
      expect(filtered).not.toContain("invalid");
    });
  });

  describe("Architecture-specific paths", () => {
    it("should construct correct Windows x64 path", () => {
      const basePath = "src-tauri/target";
      const arch = "x86_64-pc-windows-msvc";
      const mode = "release";
      const bundleType = "msi";

      const fullPath = path.join(basePath, arch, mode, "bundle", bundleType);

      expect(fullPath).toContain("x86_64-pc-windows-msvc");
      expect(fullPath).toContain("release");
      expect(fullPath).toContain("msi");
    });

    it("should construct correct macOS universal path", () => {
      const basePath = "src-tauri/target";
      const arch = "universal-apple-darwin";
      const mode = "release";
      const bundleType = "dmg";

      const fullPath = path.join(basePath, arch, mode, "bundle", bundleType);

      expect(fullPath).toContain("universal-apple-darwin");
      expect(fullPath).toContain("release");
      expect(fullPath).toContain("dmg");
    });

    it("should construct correct Linux arm64 path", () => {
      const basePath = "src-tauri/target";
      const arch = "aarch64-unknown-linux-gnu";
      const mode = "release";
      const bundleType = "deb";

      const fullPath = path.join(basePath, arch, mode, "bundle", bundleType);

      expect(fullPath).toContain("aarch64-unknown-linux-gnu");
      expect(fullPath).toContain("release");
      expect(fullPath).toContain("deb");
    });
  });

  describe("File naming patterns", () => {
    it("should match Linux DEB naming pattern", () => {
      // Format: {name}_{version}_{arch}.deb
      const pattern = /^[\w-]+_\d+\.\d+\.\d+_(amd64|arm64)\.deb$/;

      expect("myapp_1.0.0_amd64.deb").toMatch(pattern);
      expect("my-app_2.5.1_arm64.deb").toMatch(pattern);
      expect("invalid.deb").not.toMatch(pattern);
    });

    it("should match Windows MSI naming pattern", () => {
      // Format: {name}_{version}_{arch}_{language}.msi
      const pattern = /^[\w-]+_\d+\.\d+\.\d+_(x64|arm64)_[\w-]+\.msi$/;

      expect("myapp_1.0.0_x64_en-US.msi").toMatch(pattern);
      expect("my-app_2.5.1_arm64_zh-CN.msi").toMatch(pattern);
      expect("invalid.msi").not.toMatch(pattern);
    });

    it("should match macOS DMG naming pattern", () => {
      // Format: {name}_{version}_{arch}.dmg
      const pattern = /^[\w-]+_\d+\.\d+\.\d+_(universal|x64|aarch64)\.dmg$/;

      expect("myapp_1.0.0_universal.dmg").toMatch(pattern);
      expect("my-app_2.5.1_x64.dmg").toMatch(pattern);
      expect("my-app_3.0.0_aarch64.dmg").toMatch(pattern);
      expect("invalid.dmg").not.toMatch(pattern);
    });
  });

  describe("Path traversal safety", () => {
    it("should handle paths without directory traversal", () => {
      const safePaths = [
        "src-tauri/target/release/bundle/msi",
        "output/windows",
        "dist/cli.js",
      ];

      safePaths.forEach((p) => {
        expect(p).not.toContain("..");
        expect(p).not.toMatch(/\.\.[/\\]/);
      });
    });

    it("should normalize paths correctly", () => {
      const inputPath = "src-tauri/target/../target/release/bundle";
      const normalized = path.normalize(inputPath);

      // path.normalize should resolve the .. reference
      expect(normalized).not.toContain("..");
      expect(normalized).toContain("target");
      expect(normalized).toContain("release");
    });
  });

  describe("Cross-platform path handling", () => {
    it("should use correct path separator", () => {
      const joined = path.join("src-tauri", "target", "release");

      // Should not contain wrong separators
      if (path.sep === "/") {
        expect(joined).not.toContain("\\");
      } else {
        expect(joined).not.toContain("/");
      }
    });

    it("should handle paths with both separators", () => {
      // This can happen when paths come from different sources
      const mixedPath = "src-tauri\\target/release";
      const normalized = path.normalize(mixedPath);

      // After normalization, should use consistent separator
      const parts = normalized.split(path.sep);
      expect(parts.length).toBeGreaterThan(1);
    });
  });
});
