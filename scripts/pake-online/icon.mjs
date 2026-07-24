#!/usr/bin/env node

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import iconGenModule from "icon-gen";
import sharp from "sharp";

const MAX_ICON_BYTES = 10 * 1024 * 1024;
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const generateIcon = iconGenModule.default ?? iconGenModule;

export function normalizeIconUrl(value) {
  const url = new URL(String(value));
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Icon URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Icon URL must not contain credentials.");
  }
  return url.href;
}

export function isIco(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0 &&
    buffer[1] === 0 &&
    buffer[2] === 1 &&
    buffer[3] === 0
  );
}

async function downloadIcon(url) {
  const response = await fetch(normalizeIconUrl(url), {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Icon download failed with HTTP ${response.status}.`);
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_ICON_BYTES) {
    throw new Error("Icon exceeds the 10 MiB size limit.");
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_ICON_BYTES) {
      throw new Error("Icon exceeds the 10 MiB size limit.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function writeWindowsIcon(buffer, outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  await fsPromises.mkdir(path.dirname(absoluteOutput), { recursive: true });
  if (isIco(buffer)) {
    await fsPromises.writeFile(absoluteOutput, buffer);
    return absoluteOutput;
  }

  const sourceDirectory = await fsPromises.mkdtemp(
    path.join(path.dirname(absoluteOutput), ".pake-icon-"),
  );
  try {
    await Promise.all(
      ICON_SIZES.map((size) =>
        sharp(buffer)
          .resize(size, size, { fit: "contain" })
          .png()
          .toFile(path.join(sourceDirectory, `${size}.png`)),
      ),
    );
    const outputName = path.basename(
      absoluteOutput,
      path.extname(absoluteOutput),
    );
    const generated = await generateIcon(
      sourceDirectory,
      path.dirname(absoluteOutput),
      {
        ico: { name: outputName, sizes: ICON_SIZES },
        report: false,
      },
    );
    const generatedPath = generated.find((file) => file.endsWith(".ico"));
    if (!generatedPath || !fs.existsSync(generatedPath)) {
      throw new Error("ICO conversion did not produce an output file.");
    }
    if (path.resolve(generatedPath) !== absoluteOutput) {
      await fsPromises.copyFile(generatedPath, absoluteOutput);
    }
    return absoluteOutput;
  } finally {
    await fsPromises.rm(sourceDirectory, { recursive: true, force: true });
  }
}

export async function prepareWindowsIcon(url, outputPath) {
  return writeWindowsIcon(await downloadIcon(url), outputPath);
}

async function runCli() {
  const [url, outputPath] = process.argv.slice(2);
  if (!url || !outputPath) {
    throw new Error("Usage: icon.mjs <icon-url> <output.ico>");
  }
  process.stdout.write(`${await prepareWindowsIcon(url, outputPath)}\n`);
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
