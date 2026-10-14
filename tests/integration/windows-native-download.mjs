// A real Windows WebView2 probe, with a temporary Common Controls v6 manifest.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

assert.equal(
  process.platform,
  "win32",
  "This probe requires Windows and WebView2 Runtime.",
);
const root = await fs.mkdtemp(path.join(os.tmpdir(), "pake-webview2-runtime-"));
function run(command, args, timeout = 120000) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${command} failed:\n${result.stdout}`);
  return result.stdout;
}
const registry = run("reg.exe", [
  "query",
  "HKLM\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots",
  "/v",
  "KitsRoot10",
]);
const sdkRoot = registry.match(/KitsRoot10\s+REG_SZ\s+([^\r\n]+)/)?.[1];
assert.ok(sdkRoot, "Windows SDK installation was not found.");
const versions = (await fs.readdir(path.join(sdkRoot, "bin")))
  .filter((name) => /^\d+\./.test(name))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
let mt;
for (const version of versions) {
  const candidate = path.join(
    sdkRoot,
    "bin",
    version,
    process.arch === "arm64" ? "arm64" : "x64",
    "mt.exe",
  );
  try {
    await fs.access(candidate);
    mt = candidate;
    break;
  } catch {
    /* Try the next installed SDK. */
  }
}
assert.ok(mt, "Windows SDK mt.exe was not found.");
const output = run("cargo", [
  "test",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--lib",
  "--features",
  "native-download-probe",
  "--no-run",
  "--message-format=json",
]);
const artifact = output
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .find(
    (item) =>
      item.reason === "compiler-artifact" &&
      item.target.name === "app_lib" &&
      item.profile.test &&
      item.executable,
  );
assert.ok(
  artifact,
  "Cargo did not produce the native library test executable.",
);
const executable = path.join(root, "probe.exe");
await fs.copyFile(artifact.executable, executable);
const manifest = path.join(root, "probe.manifest");
await fs.writeFile(
  manifest,
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"><dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency></assembly>',
);
run(mt, ["-nologo", "-manifest", manifest, `-outputresource:${executable};#1`]);
process.stdout.write(
  run(
    executable,
    ["native_windows_download", "--ignored", "--nocapture"],
    60000,
  ),
);
console.log(`Native probe executable and manifest retained at ${root}`);
