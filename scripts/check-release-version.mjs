#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// Only trust GITHUB_REF_NAME when the workflow actually runs on a tag;
// on workflow_dispatch it holds the branch name, which is not a version.
const refTag =
  process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "";
const tag = process.argv[2] || refTag;
const errors = [];

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${expected}, got ${actual || "<missing>"}`);
  }
}

function extractCargoVersion() {
  const cargoToml = readText("src-tauri/Cargo.toml");
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return match?.[1];
}

function extractCargoLockVersion() {
  const cargoLock = readText("src-tauri/Cargo.lock");
  const match = cargoLock.match(
    /\[\[package\]\]\s+name = "pake"\s+version = "([^"]+)"/,
  );
  return match?.[1];
}

function extractDistVersion() {
  const distCli = readText("dist/cli.js");
  const match = distCli.match(
    /\b(?:var|let|const)\s+version\s*=\s*["']([^"']+)["'];/,
  );
  return match?.[1];
}

const packageJson = readJson("package.json");
const packageVersion = packageJson.version;
const expectedTag = tag || `V${packageVersion}`;

if (!/^V\d+\.\d+\.\d+$/.test(expectedTag)) {
  errors.push(
    `release tag must match Vx.y.z, got ${expectedTag || "<missing>"}`,
  );
} else {
  expectEqual("tag version", expectedTag.slice(1), packageVersion);
}

expectEqual(
  "src-tauri/Cargo.toml version",
  extractCargoVersion(),
  packageVersion,
);
expectEqual(
  "src-tauri/Cargo.lock version",
  extractCargoLockVersion(),
  packageVersion,
);
expectEqual(
  "src-tauri/tauri.conf.json version",
  readJson("src-tauri/tauri.conf.json").version,
  packageVersion,
);
expectEqual(
  "dist/cli.js bundled version",
  extractDistVersion(),
  packageVersion,
);
expectEqual(
  "package.json repository.url",
  packageJson.repository?.url,
  "git+https://github.com/tw93/Pake.git",
);

if (!packageJson.files?.includes("LICENSE-EXCEPTION")) {
  errors.push(
    "package.json files: LICENSE-EXCEPTION must be included in the npm package",
  );
}

if (!packageJson.files?.includes("llms.txt")) {
  errors.push(
    "package.json files: llms.txt must be included in the npm package",
  );
}

if (!packageJson.files?.includes("dist/cli.js")) {
  errors.push(
    "package.json files: dist/cli.js must be included in the npm package",
  );
}

if (packageJson.files?.includes("dist")) {
  errors.push(
    "package.json files: include dist/cli.js instead of the entire generated dist directory",
  );
}

if (errors.length > 0) {
  console.error("Release version check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Release version check passed for V${packageVersion}`);
