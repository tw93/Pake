#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ONLINE_MANIFEST_SCHEMA_VERSION = 1;
const MANIFEST_PREFIX = "pake-online-manifest-";

const FORMATS = [
  [".pkg.tar.zst", "zst"],
  [".tar.zst", "tar.zst"],
  [".AppImage", "appimage"],
  [".msi", "msi"],
  [".exe", "exe"],
  [".dmg", "dmg"],
  [".deb", "deb"],
  [".rpm", "rpm"],
];

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function assetExtension(format) {
  if (format === "zst") return "pkg.tar.zst";
  return format;
}

export function detectArtifactFormat(fileName) {
  return FORMATS.find(([suffix]) => fileName.endsWith(suffix))?.[1] ?? null;
}

export function findInstallerFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .map((name) => path.join(directory, name))
    .filter(
      (filePath) =>
        fs.statSync(filePath).isFile() &&
        detectArtifactFormat(path.basename(filePath)),
    )
    .sort();
}

export function onlineInstallerAssetName(config) {
  const base = config.id;
  if (config.os === "windows") {
    const format = config.delivery?.onlineWindowsFormat ?? "msi";
    if (!["msi", "exe"].includes(format)) {
      throw new Error(`Unsupported Windows online installer format: ${format}`);
    }
    return `${base}-online-installer.${format}`;
  }
  if (config.os === "macos") return `${base}-online-installer.dmg`;
  return `${base}-online-installer.AppImage`;
}

export function stageReleaseAssets(config, context) {
  const inputDirectory = context.inputDirectory;
  const outputDirectory = context.outputDirectory;
  const sourceSha = context.sourceSha;
  const shortSha = sourceSha.slice(0, 12);
  const actualDirectory = path.join(outputDirectory, "actual");
  const manifestDirectory = path.join(outputDirectory, "manifest");
  fs.mkdirSync(actualDirectory, { recursive: true });
  fs.mkdirSync(manifestDirectory, { recursive: true });

  const sourceFiles = findInstallerFiles(inputDirectory);
  if (sourceFiles.length === 0) {
    throw new Error(`No installer artifacts found in ${inputDirectory}`);
  }

  const artifacts = sourceFiles.map((sourcePath) => {
    const format = detectArtifactFormat(path.basename(sourcePath));
    const name = `${config.id}-${shortSha}.${assetExtension(format)}`;
    const targetPath = path.join(actualDirectory, name);
    fs.copyFileSync(sourcePath, targetPath);
    const size = fs.statSync(targetPath).size;
    const artifact = {
      name,
      format,
      size,
      sha256: sha256File(targetPath),
      downloadUrl: `https://github.com/${config.repository}/releases/download/${config.releaseTag}/${name}`,
      packageId: config.cliConfig.name,
    };
    if (format === "tar.zst") {
      const metadataPath = `${sourcePath}.json`;
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Windows payload metadata is missing: ${metadataPath}`);
      }
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      if (
        metadata.format !== "tar.zst" ||
        !Number.isSafeInteger(metadata.expandedSize) ||
        metadata.expandedSize <= 0 ||
        typeof metadata.executableName !== "string" ||
        typeof metadata.executableSha256 !== "string"
      ) {
        throw new Error(`Windows payload metadata is invalid: ${metadataPath}`);
      }
      artifact.expandedSize = metadata.expandedSize;
      artifact.executableName = metadata.executableName;
      artifact.executableSha256 = metadata.executableSha256;
      artifact.packageId = config.id;
    }
    return artifact;
  });

  const onlineInstaller = {
    name: onlineInstallerAssetName(config),
  };
  const manifestName = `${MANIFEST_PREFIX}${shortSha}-${context.runAttempt ?? "1"}.json`;
  const manifest = {
    schemaVersion: ONLINE_MANIFEST_SCHEMA_VERSION,
    configId: config.id,
    repository: config.repository,
    releaseTag: config.releaseTag,
    source: {
      branch: config.sourceBranch,
      sha: sourceSha,
      builtAt: context.builtAt ?? new Date().toISOString(),
    },
    application: {
      name: config.cliConfig.name,
      version: config.cliConfig.appVersion,
    },
    platform: {
      runner: config.runner,
      os: config.os,
      arch:
        config.os === "macos" && config.cliConfig.multiArch
          ? "universal"
          : context.arch,
    },
    artifacts,
    onlineInstaller,
  };
  const manifestPath = path.join(manifestDirectory, manifestName);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { manifest, manifestPath, actualDirectory };
}

export function selectReleaseAssetsToDelete(assets, manifests, assetPrefix) {
  const manifestAssets = assets
    .filter((asset) => asset.name.startsWith(MANIFEST_PREFIX))
    .sort((a, b) => b.id - a.id);
  const keptManifestAssets = manifestAssets.slice(0, 2);
  const keep = new Set(keptManifestAssets.map((asset) => asset.name));

  for (const asset of keptManifestAssets) {
    const manifest = manifests.get(asset.name);
    if (!manifest) continue;
    for (const artifact of manifest.artifacts ?? []) keep.add(artifact.name);
    if (manifest.onlineInstaller?.name) {
      keep.add(manifest.onlineInstaller.name);
    }
  }

  return assets.filter((asset) => {
    const managed =
      asset.name.startsWith(MANIFEST_PREFIX) ||
      asset.name.startsWith(`${assetPrefix}-`);
    return managed && !keep.has(asset.name);
  });
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pake-online-release",
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(
      `GitHub API ${response.status} ${response.statusText}: ${await response.text()}`,
    );
  }
  return response;
}

async function downloadManifest(asset) {
  const response = await githubRequest(asset.url, {
    headers: { Accept: "application/octet-stream" },
    redirect: "follow",
  });
  return response.json();
}

export async function cleanupReleaseAssets(repository, tag, assetPrefix) {
  const releaseResponse = await githubRequest(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
  );
  const release = await releaseResponse.json();
  const manifestAssets = release.assets
    .filter((asset) => asset.name.startsWith(MANIFEST_PREFIX))
    .sort((a, b) => b.id - a.id)
    .slice(0, 2);
  const manifests = new Map();
  for (const asset of manifestAssets) {
    manifests.set(asset.name, await downloadManifest(asset));
  }
  const deletions = selectReleaseAssetsToDelete(
    release.assets,
    manifests,
    assetPrefix,
  );
  for (const asset of deletions) {
    await githubRequest(asset.url, { method: "DELETE" });
    console.log(`Deleted old release asset: ${asset.name}`);
  }
  return deletions;
}

function appendGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${JSON.stringify(values)}\n`);
    return;
  }
  fs.appendFileSync(
    outputPath,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "stage") {
    const [configPath, inputDirectory, outputDirectory] = args;
    if (!configPath || !inputDirectory || !outputDirectory) {
      throw new Error("stage requires config, input, and output paths");
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const result = stageReleaseAssets(config, {
      inputDirectory,
      outputDirectory,
      sourceSha: process.env.GITHUB_SHA,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      arch: process.env.RUNNER_ARCH ?? process.arch,
    });
    appendGithubOutput({
      manifest_path: result.manifestPath,
      manifest_name: path.basename(result.manifestPath),
      actual_directory: result.actualDirectory,
      online_installer_name: result.manifest.onlineInstaller.name,
    });
    return;
  }

  if (command === "cleanup") {
    const [repository, tag, assetPrefix] = args;
    if (!repository || !tag || !assetPrefix) {
      throw new Error("cleanup requires repository, tag, and asset prefix");
    }
    await cleanupReleaseAssets(repository, tag, assetPrefix);
    return;
  }

  throw new Error(`Unknown command: ${command ?? "<missing>"}`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
