#!/usr/bin/env node
// Downloads the filter lists that runtime templates built with the
// `content-blocking` feature embed, and stores them gzipped under filters/.
// Run it before a runtime release; the lists age within days of a download.
import { gzipSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "filters");

// Group names are the values of `content_blocking` in pake.json.
export const LISTS = [
  { file: "ads", url: "https://easylist.to/easylist/easylist.txt" },
  { file: "trackers", url: "https://easylist.to/easylist/easyprivacy.txt" },
  {
    file: "cookies",
    url: "https://filters.adtidy.org/extension/ublock/filters/18.txt",
  },
  {
    file: "china",
    url: "https://easylist-downloads.adblockplus.org/easylistchina.txt",
  },
  // Always added to any selection: fixes for sites the other lists break.
  {
    file: "unbreak",
    url: "https://ublockorigin.github.io/uAssets/filters/unbreak.txt",
  },
];

function header(text, key) {
  const line = text
    .split("\n", 40)
    .find((l) => l.toLowerCase().startsWith(`! ${key.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

mkdirSync(out, { recursive: true });
const sources = [];
for (const { file, url } of LISTS) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes("##") && !text.includes("||")) {
    throw new Error(`${url} does not look like a filter list`);
  }
  // mtime 0 keeps the gzip bytes stable for the same text.
  writeFileSync(join(out, `${file}.txt.gz`), gzipSync(text, { level: 9 }));
  sources.push({
    group: file,
    title: header(text, "Title"),
    version: header(text, "Version") || header(text, "Last modified"),
    url,
    license: header(text, "Licence") || header(text, "License"),
    lines: text.split("\n").length,
  });
  console.log(`${file}: ${text.length} bytes`);
}
writeFileSync(
  join(out, "sources.json"),
  JSON.stringify(
    { fetched: new Date().toISOString().slice(0, 10), lists: sources },
    null,
    2,
  ) + "\n",
);
