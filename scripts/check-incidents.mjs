// Every row of docs/incidents.md names real commits, a known layer and a
// catcher the code defines.
//
//   node scripts/check-incidents.mjs
//
// The incident table is the eval set for the review layers (docs/incidents.md
// says why and what each layer means). A row fails when its ID repeats, its
// Reported cell is not a date, its Fixed commit is missing or does not
// resolve, its Introduced commit is neither `unknown` nor a commit, its layer
// is not one of LAYERS, or a backticked catcher is defined nowhere: not a
// Vitest or node:test title under tests/ or bin/, not a Rust #[test] function
// under src-tauri/src, and not a file in this repository.
//
// In a shallow clone (CI checks out one commit) the commits cannot be resolved
// and are only shape-checked, which the output says. tests/unit/
// check-incidents.test.ts runs the same check, so `npx vitest run` (in
// release:check and the CI fast suite) fails on a broken row.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const LEDGER = path.join(ROOT, "docs", "incidents.md");
export const LAYERS = [
  "write-time",
  "unit",
  "cli-build",
  "ci",
  "review",
  "release-check",
  "native",
  "field",
];
export const COLUMNS = [
  "ID",
  "Reported",
  "Symptom",
  "Introduced",
  "Fixed",
  "Layer",
  "Caught by",
];
const SHA = /^[0-9a-f]{7,40}$/;
const JS_TITLE =
  /\b(?:it|test|describe)(?:\.(?:only|skip|concurrent|each\([^)]*\)))?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$]*)`)/g;
const RUST_TEST = /#\[test\]\s*(?:#\[[^\]]*\]\s*)*fn\s+([A-Za-z0-9_]+)\s*\(/g;
const SKIP_DIRS = new Set(["node_modules", "target", ".git", "dist"]);

function* walk(dir, extensions) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

const unescape = (title) => title.replace(/\\(.)/g, "$1");

export function definedCatchers(root = ROOT) {
  const names = new Set();
  for (const dir of ["tests", "bin"]) {
    for (const file of walk(path.join(root, dir), [".js", ".mjs", ".ts"])) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(JS_TITLE)) {
        names.add(unescape(match[1] ?? match[2] ?? match[3]));
      }
    }
  }
  for (const file of walk(path.join(root, "src-tauri", "src"), [".rs"])) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(RUST_TEST)) names.add(match[1]);
  }
  return names;
}

export function isDefined(catcher, defined, root = ROOT) {
  if (defined.has(catcher)) return true;
  // A test file or gate script named by its repository path.
  return (
    catcher.includes("/") &&
    fs.existsSync(path.join(root, catcher)) &&
    fs.statSync(path.join(root, catcher)).isFile()
  );
}

// The table under '## Incidents' as [line number, cells], header and rule
// excluded. Cells are trimmed, so Prettier's column padding is harmless.
export function* rows(text) {
  let section = false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      section = line.trim() === "## Incidents";
      continue;
    }
    if (!section || !line.startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.join("|") === COLUMNS.join("|")) continue;
    if (/^[-:\s]*$/.test(cells.join(""))) continue;
    yield [i + 1, cells];
  }
}

export function isShallow(root = ROOT) {
  const out = spawnSync(
    "git",
    ["-C", root, "rev-parse", "--is-shallow-repository"],
    { encoding: "utf8" },
  );
  return out.stdout.trim() === "true";
}

export function resolves(sha, root = ROOT) {
  return (
    spawnSync("git", ["-C", root, "cat-file", "-e", `${sha}^{commit}`])
      .status === 0
  );
}

export function problems(
  text,
  {
    label = "docs/incidents.md",
    defined,
    checkCommits,
    resolve = resolves,
    root = ROOT,
  },
) {
  const found = [];
  const seen = new Set();
  for (const [number, cells] of rows(text)) {
    const where = `${label}:${number}`;
    if (cells.length !== COLUMNS.length) {
      found.push(
        `${where}: expected ${COLUMNS.length} cells, found ${cells.length}`,
      );
      continue;
    }
    const row = Object.fromEntries(COLUMNS.map((name, i) => [name, cells[i]]));
    if (seen.has(row.ID)) found.push(`${where}: ${row.ID} repeats`);
    seen.add(row.ID);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.Reported)) {
      found.push(`${where}: Reported is not a date: ${row.Reported}`);
    }
    for (const [column, optional] of [
      ["Fixed", false],
      ["Introduced", true],
    ]) {
      const value = row[column];
      if (optional && value === "unknown") continue;
      if (!SHA.test(value)) {
        found.push(`${where}: ${column} is not a commit: ${value}`);
      } else if (checkCommits && !resolve(value)) {
        found.push(`${where}: ${column} ${value} does not resolve`);
      }
    }
    if (!LAYERS.includes(row.Layer)) {
      found.push(
        `${where}: layer ${row.Layer} is not one of ${LAYERS.join(", ")}`,
      );
    }
    const catchers = [...row["Caught by"].matchAll(/`([^`]+)`/g)].map(
      (match) => match[1],
    );
    if (catchers.length === 0) found.push(`${where}: no catcher named`);
    for (const name of catchers) {
      if (!isDefined(name, defined, root)) {
        found.push(
          `${where}: catcher \`${name}\` is not a test or gate in this repository`,
        );
      }
    }
  }
  return found;
}

export function checkLedger(ledger = LEDGER) {
  const shallow = isShallow();
  const text = fs.readFileSync(ledger, "utf8");
  const found = problems(text, {
    label: path.relative(ROOT, ledger),
    defined: definedCatchers(),
    checkCommits: !shallow,
  });
  return { found, shallow, count: [...rows(text)].length };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { found, shallow, count } = checkLedger();
  for (const line of found) console.log(line);
  const note = shallow ? ", commits shape-checked only (shallow clone)" : "";
  console.log(`incidents: ${count} rows, ${found.length} problems${note}`);
  process.exit(found.length ? 1 : 0);
}
