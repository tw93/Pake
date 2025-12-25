/**
 * Cross-platform file finding tests
 *
 * These tests verify that file finding logic works correctly
 * across different platforms (Windows, macOS, Linux).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("Cross-platform file finding", () => {
  let tempDir;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pake-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("findFilesByPattern", () => {
    /**
     * Simulates the fixed findOutputFiles logic from tests/release.js
     */
    function findFilesByPattern(dir, pattern) {
      const files = [];

      if (!fs.existsSync(dir)) {
        return files;
      }

      const items = fs.readdirSync(dir);

      // Convert glob pattern to regex
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      );

      const matching = items.filter((item) => regex.test(item));

      matching.forEach((item) => {
        const fullPath = path.join(dir, item);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() || item.endsWith(".app")) {
            files.push(fullPath);
          }
        } catch (error) {
          // Skip files we can't stat
        }
      });

      return files;
    }

    it("should find exact filename matches", () => {
      const testFile = path.join(tempDir, "test.deb");
      fs.writeFileSync(testFile, "test content");

      const found = findFilesByPattern(tempDir, "test.deb");

      expect(found).toHaveLength(1);
      expect(found[0]).toBe(testFile);
    });

    it("should find files with wildcard patterns", () => {
      const files = [
        "myapp_1.0.0_amd64.deb",
        "myapp_1.0.0_arm64.deb",
        "other.txt",
      ];

      files.forEach((file) => {
        fs.writeFileSync(path.join(tempDir, file), "test");
      });

      const found = findFilesByPattern(tempDir, "myapp_*.deb");

      expect(found).toHaveLength(2);
      expect(found.map((f) => path.basename(f)).sort()).toEqual([
        "myapp_1.0.0_amd64.deb",
        "myapp_1.0.0_arm64.deb",
      ]);
    });

    it("should handle question mark wildcards", () => {
      const files = ["app1.msi", "app2.msi", "app10.msi"];

      files.forEach((file) => {
        fs.writeFileSync(path.join(tempDir, file), "test");
      });

      const found = findFilesByPattern(tempDir, "app?.msi");

      expect(found).toHaveLength(2);
      expect(found.map((f) => path.basename(f)).sort()).toEqual([
        "app1.msi",
        "app2.msi",
      ]);
    });

    it("should return empty array for non-existent directory", () => {
      const nonExistent = path.join(tempDir, "does-not-exist");
      const found = findFilesByPattern(nonExistent, "*.deb");

      expect(found).toHaveLength(0);
    });

    it("should work on Windows paths", () => {
      // Test with backslashes (Windows-style paths)
      const testFile = path.join(tempDir, "windows-test.msi");
      fs.writeFileSync(testFile, "test content");

      const found = findFilesByPattern(tempDir, "*.msi");

      expect(found).toHaveLength(1);
      expect(path.basename(found[0])).toBe("windows-test.msi");
    });

    it("should handle .app bundles on macOS", () => {
      const appBundle = path.join(tempDir, "MyApp.app");
      fs.mkdirSync(appBundle, { recursive: true });

      const found = findFilesByPattern(tempDir, "MyApp.app");

      expect(found).toHaveLength(1);
      expect(found[0]).toBe(appBundle);
    });

    it("should ignore subdirectories when matching files", () => {
      const subdir = path.join(tempDir, "subdir.deb");
      fs.mkdirSync(subdir);

      const file = path.join(tempDir, "app.deb");
      fs.writeFileSync(file, "test");

      const found = findFilesByPattern(tempDir, "*.deb");

      // Should only find the file, not the directory
      expect(found).toHaveLength(1);
      expect(found[0]).toBe(file);
    });
  });

  describe("findInMultipleLocations", () => {
    /**
     * Simulates the pattern used in workflow files:
     * Check project root first, then fallback to bundle directory
     */
    function findInMultipleLocations(locations) {
      for (const location of locations) {
        const fullPath = path.join(tempDir, location);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      return null;
    }

    it("should find file in first location", () => {
      const file1 = path.join(tempDir, "test.dmg");
      fs.writeFileSync(file1, "test");

      const found = findInMultipleLocations([
        "test.dmg",
        "src-tauri/target/release/bundle/dmg/test.dmg",
      ]);

      expect(found).toBe(file1);
    });

    it("should fallback to second location", () => {
      const bundleDir = path.join(
        tempDir,
        "src-tauri/target/release/bundle/dmg",
      );
      fs.mkdirSync(bundleDir, { recursive: true });

      const file2 = path.join(bundleDir, "test.dmg");
      fs.writeFileSync(file2, "test");

      const found = findInMultipleLocations([
        "test.dmg",
        "src-tauri/target/release/bundle/dmg/test.dmg",
      ]);

      expect(found).toBe(file2);
    });

    it("should return null when file not found", () => {
      const found = findInMultipleLocations([
        "test.dmg",
        "other/path/test.dmg",
      ]);

      expect(found).toBeNull();
    });

    it("should work with Windows paths", () => {
      const msiDir = path.join(
        tempDir,
        "src-tauri",
        "target",
        "x86_64-pc-windows-msvc",
        "release",
        "bundle",
        "msi",
      );
      fs.mkdirSync(msiDir, { recursive: true });

      const msiFile = path.join(msiDir, "test.msi");
      fs.writeFileSync(msiFile, "test");

      const found = findInMultipleLocations([
        "test.msi",
        "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/test.msi",
      ]);

      expect(found).toBe(msiFile);
    });
  });

  describe("Path normalization", () => {
    it("should handle mixed slashes", () => {
      // This is important for cross-platform compatibility
      const mixedPath = "src-tauri\\target/release\\bundle/msi";
      const normalized = path.normalize(mixedPath);

      expect(normalized).toBeTruthy();
      // Should work regardless of platform
    });

    it("should handle path.join correctly on all platforms", () => {
      const joined = path.join(
        "src-tauri",
        "target",
        "release",
        "bundle",
        "msi",
      );

      // Should use platform-specific separator
      const parts = joined.split(path.sep);
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe("src-tauri");
      expect(parts[4]).toBe("msi");
    });
  });
});
