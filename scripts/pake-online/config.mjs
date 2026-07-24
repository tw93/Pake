#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ONLINE_CONFIG_SCHEMA_VERSION = 1;
export const ONLINE_CONFIG_BRANCH = "pake-online-config";

const PLATFORM_MAP = {
  "windows-latest": "windows",
  "macos-latest": "macos",
  "ubuntu-24.04": "linux",
};

const DEFAULT_TARGETS = {
  "windows-latest": "msi",
  "macos-latest": "dmg",
  "ubuntu-24.04": "deb",
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const BOOLEAN_INPUTS = [
  ["fullscreen", "fullscreen"],
  ["hide_title_bar", "hideTitleBar"],
  ["multi_arch", "multiArch"],
];

function asBoolean(value) {
  return value === true || value === "true";
}

function optionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function optionalWebUrl(value, field) {
  const normalized = optionalString(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${field} must use http or https`);
  }
  if (url.username || url.password) {
    throw new Error(`${field} must not contain credentials`);
  }
  return normalized;
}

function positiveInteger(value, field, allowZero = false) {
  const parsed = Number(String(value));
  if (!Number.isInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(
      `${field} must be ${allowZero ? "a non-negative" : "a positive"} integer`,
    );
  }
  return parsed;
}

function normalizeOnlineWindowsFormat(value) {
  const format = optionalString(value) ?? "msi";
  if (!["msi", "exe"].includes(format)) {
    throw new Error(`Unsupported online Windows installer format: ${format}`);
  }
  return format;
}

export function slugify(value, fallback = "app") {
  const slug = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

export function createConfigId({ repository, sourceBranch, platform, name }) {
  const os = PLATFORM_MAP[platform];
  if (!os) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  const identity = `${repository}\n${sourceBranch}\n${platform}\n${name}`;
  const digest = crypto.createHash("sha256").update(identity).digest("hex");
  return `${slugify(name)}-${os}-${digest.slice(0, 10)}`;
}

export function normalizeReleaseVersion(tagName) {
  const version = String(tagName ?? "")
    .trim()
    .replace(/^[vV]/, "");
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `Latest release tag must contain a semantic version, received: ${tagName || "<empty>"}`,
    );
  }
  return version;
}

export function applyOnlineReleaseVersion(config, releaseTag) {
  if (!config.online) return config;
  return {
    ...config,
    cliConfig: {
      ...config.cliConfig,
      appVersion: normalizeReleaseVersion(releaseTag),
    },
  };
}

export function normalizeCliConfig(inputs) {
  const platform = String(inputs.platform ?? "");
  if (!PLATFORM_MAP[platform]) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const url = optionalString(inputs.url);
  if (!url) {
    throw new Error("url is required");
  }
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("url must use http or https");
  }

  const name = optionalString(inputs.name);
  if (!name) {
    throw new Error("name is required");
  }

  const cliConfig = {
    url,
    name,
    icon: optionalString(inputs.icon) ?? "",
    width: positiveInteger(inputs.width ?? 1200, "width"),
    height: positiveInteger(inputs.height ?? 780, "height"),
    minWidth: positiveInteger(inputs.min_width || 0, "min_width", true),
    minHeight: positiveInteger(inputs.min_height || 0, "min_height", true),
    appVersion: optionalString(inputs.app_version) ?? "1.0.0",
    targets:
      PLATFORM_MAP[platform] === "linux"
        ? (optionalString(inputs.targets) ?? DEFAULT_TARGETS[platform])
        : DEFAULT_TARGETS[platform],
  };

  for (const [inputName, configName] of BOOLEAN_INPUTS) {
    cliConfig[configName] = asBoolean(inputs[inputName]);
  }

  return cliConfig;
}

export function createBuildConfig(inputs, context) {
  const platform = String(inputs.platform ?? "");
  const os = PLATFORM_MAP[platform];
  const repository = String(context.repository ?? "");
  const sourceBranch = String(context.sourceBranch ?? "");
  const onlineMode = asBoolean(inputs.online_mode);
  const operation = onlineMode
    ? String(inputs.online_operation ?? "enable-or-update")
    : "build-once";

  if (!repository.includes("/")) {
    throw new Error("repository must use owner/name format");
  }
  if (!sourceBranch) {
    throw new Error("sourceBranch is required");
  }
  if (onlineMode && !["enable-or-update", "pause"].includes(operation)) {
    throw new Error(`Unsupported online operation: ${operation}`);
  }

  const cliConfig = normalizeCliConfig(inputs);
  const stableId = createConfigId({
    repository,
    sourceBranch,
    platform,
    name: cliConfig.name,
  });
  const id = onlineMode
    ? stableId
    : `manual-${slugify(cliConfig.name)}-${context.runId ?? "local"}`;
  const now = context.now ?? new Date().toISOString();

  return {
    schemaVersion: ONLINE_CONFIG_SCHEMA_VERSION,
    id,
    repository,
    sourceBranch,
    runner: platform,
    os,
    online: onlineMode,
    operation,
    releaseTag: onlineMode ? `pake-online-${stableId}` : null,
    cliConfig,
    delivery: {
      windowsOfflineExe: asBoolean(inputs.offline_exe),
      onlineWindowsFormat: normalizeOnlineWindowsFormat(
        inputs.online_windows_format,
      ),
      offlineExeIcon: optionalWebUrl(
        inputs.offline_exe_icon,
        "offline_exe_icon",
      ),
      onlineExeIcon: optionalWebUrl(inputs.online_exe_icon, "online_exe_icon"),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertRegistryConfig(directory, config) {
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${config.id}.json`);
  let createdAt = config.createdAt;
  if (fs.existsSync(filePath)) {
    const previous = JSON.parse(fs.readFileSync(filePath, "utf8"));
    createdAt = previous.createdAt ?? createdAt;
  }
  const stored = { ...config, operation: "enable-or-update", createdAt };
  fs.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`);
  return filePath;
}

export function pauseRegistryConfig(directory, configId) {
  const filePath = path.join(directory, `${configId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.rmSync(filePath);
  return true;
}

export function loadRegistryConfigs(directory, sourceBranch) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) =>
      JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")),
    )
    .filter(
      (config) =>
        config.schemaVersion === ONLINE_CONFIG_SCHEMA_VERSION &&
        config.online === true &&
        config.sourceBranch === sourceBranch,
    );
}

export function createMatrix(configs) {
  return { include: configs.map((config) => ({ config })) };
}

function appendGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${JSON.stringify(values)}\n`);
    return;
  }
  const lines = Object.entries(values).map(
    ([key, value]) => `${key}=${String(value)}`,
  );
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

function readJsonFromEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return JSON.parse(value);
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "dispatch") {
    const outputPath = args[0];
    if (!outputPath) throw new Error("dispatch requires an output path");
    const config = createBuildConfig(
      readJsonFromEnvironment("PAKE_ONLINE_INPUTS"),
      {
        repository: process.env.GITHUB_REPOSITORY,
        sourceBranch: process.env.GITHUB_REF_NAME,
        runId: process.env.GITHUB_RUN_ID,
      },
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
    const configs =
      config.operation === "pause" ? [] : [{ ...config, operation: "build" }];
    appendGithubOutput({
      matrix: JSON.stringify(createMatrix(configs)),
      has_configs: configs.length > 0,
      online_mode: config.online,
      operation: config.operation,
      config_id: config.id,
      registry_filename: `${config.id}.json`,
    });
    return;
  }

  if (command === "matrix") {
    const [directory, sourceBranch] = args;
    if (!directory || !sourceBranch) {
      throw new Error("matrix requires a registry directory and branch");
    }
    const configs = loadRegistryConfigs(directory, sourceBranch).map(
      (config) => ({ ...config, operation: "build" }),
    );
    appendGithubOutput({
      matrix: JSON.stringify(createMatrix(configs)),
      has_configs: configs.length > 0,
    });
    return;
  }

  if (command === "runtime") {
    const [buildConfigPath, cliConfigPath] = args;
    if (!buildConfigPath || !cliConfigPath) {
      throw new Error(
        "runtime requires build config and CLI config output paths",
      );
    }
    const config = applyOnlineReleaseVersion(
      readJsonFromEnvironment("PAKE_ONLINE_BUILD_CONFIG"),
      process.env.PAKE_LATEST_RELEASE_TAG,
    );
    fs.writeFileSync(buildConfigPath, `${JSON.stringify(config, null, 2)}\n`);
    fs.writeFileSync(
      cliConfigPath,
      `${JSON.stringify(config.cliConfig, null, 2)}\n`,
    );
    return;
  }

  if (command === "upsert") {
    const [configPath, directory] = args;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    process.stdout.write(`${upsertRegistryConfig(directory, config)}\n`);
    return;
  }

  if (command === "pause") {
    const [directory, configId] = args;
    process.stdout.write(
      `${pauseRegistryConfig(directory, configId) ? "removed" : "missing"}\n`,
    );
    return;
  }

  throw new Error(`Unknown command: ${command ?? "<missing>"}`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
