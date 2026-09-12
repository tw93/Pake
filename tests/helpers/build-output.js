import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function verifyBuildOutput(code, stdout, expectedPath) {
  assert.equal(code, 0, `Build exited with code ${code}`);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true, "CLI did not report a successful build");
  assert.ok(fs.existsSync(expectedPath), "Expected artifact is missing");
  const expectedRealPath = fs.realpathSync(expectedPath);
  assert.ok(
    result.outputs?.some((output) => {
      try {
        return fs.realpathSync(output.path) === expectedRealPath;
      } catch {
        return false;
      }
    }),
    "CLI did not report the expected artifact",
  );
  const stat = fs.statSync(expectedPath);
  assert.ok(
    stat.isDirectory() || (stat.isFile() && stat.size > 0),
    "Build artifact is empty",
  );
}

export function verifyMacApp(appPath, requiredArchitectures) {
  const executable = execFileSync(
    "/usr/bin/plutil",
    [
      "-extract",
      "CFBundleExecutable",
      "raw",
      "-o",
      "-",
      path.join(appPath, "Contents", "Info.plist"),
    ],
    { encoding: "utf8" },
  ).trim();
  assert.ok(
    executable && path.basename(executable) === executable,
    "Invalid executable name",
  );
  const binary = path.join(appPath, "Contents", "MacOS", executable);
  const stat = fs.statSync(binary);
  assert.ok(stat.isFile() && stat.size > 0, "Application executable is empty");
  const architectures = execFileSync("/usr/bin/lipo", ["-archs", binary], {
    encoding: "utf8",
  })
    .trim()
    .split(/\s+/);
  for (const architecture of requiredArchitectures) {
    assert.ok(
      architectures.includes(architecture),
      `Missing architecture: ${architecture}`,
    );
  }
}
