// Name the verification a change needs from the paths it touches, not from
// who wrote it.
//
//   node scripts/risk-tier.mjs [path ...]
//   node scripts/risk-tier.mjs --self-check
//
// With no paths it reads the change not yet on the upstream branch: commits
// since the merge base with @{upstream} (origin/main when there is none) plus
// staged, unstaged and untracked files. It prints one line per tier the change
// reaches, highest first, and nothing when only the default checks apply. It
// is advice, never a failure: the gates it names need a real OS, the release
// workflows or the maintainer, where a local script cannot prove they ran.
// Pass your own files when the worktree holds other work.
//
// --self-check exits 1 when a tier pattern matches no tracked file: a rename
// would otherwise drop that file to the default tier without anyone noticing.
// tests/unit/risk-tier.test.ts runs it.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Highest first. A path takes every tier it matches. Patterns are literal
// paths, or end in `/*` to cover every file below that directory.
export const TIERS = [
  {
    name: "publish",
    gates:
      "the maintainer's review of the diff; Trusted Publishing kept (id-token: write, the canonical repository URL, " +
      "scripts/check-release-version.mjs; AGENTS.md Review Hard Stops); pnpm run release:check; " +
      "the changed workflow green at the exact SHA before any tag or npm-only dispatch",
    patterns: [
      ".github/workflows/npm-publish.yml",
      ".github/workflows/release.yml",
      "scripts/check-release-version.mjs",
      "default_app_list.json",
    ],
  },
  {
    name: "public-workflow",
    gates:
      "inputs reach run: scripts through env: only (tests/integration/workflow-paths.test.js, " +
      "tests/unit/action-input-security.test.ts); pake-cli.yaml and single-app.yaml reach fork users on push to main, " +
      "action.yml reaches v3 users only after the release moves the v3 tag",
    patterns: [
      "action.yml",
      ".github/workflows/pake-cli.yaml",
      ".github/workflows/single-app.yaml",
    ],
  },
  {
    name: "ci",
    gates:
      "no new `|| true` or continue-on-error on a gating step; a changed gate red-run once on a known-bad sample; " +
      "Run Fast Test Suite and Rust Code Quality green at the exact pushed SHA",
    patterns: [
      ".github/workflows/quality-and-test.yml",
      ".github/actions/*",
      "tests/index.js",
      "scripts/check-incidents.mjs",
      "scripts/risk-tier.mjs",
    ],
  },
  {
    name: "ipc-permission",
    gates:
      "cargo test --lib (with and without --features runtime-template); node tests/integration/ipc-security.mjs " +
      "on a real macOS WebView; every app command in the build.rs manifest with only its required permissions",
    patterns: [
      "src-tauri/build.rs",
      "src-tauri/capabilities/*",
      "src-tauri/src/app/invoke.rs",
      "src-tauri/src/app/config.rs",
      "src-tauri/src/inject/event.js",
      "src-tauri/src/inject/frame_links.js",
      "src-tauri/src/inject/link_policy.js",
      "src-tauri/src/inject/fullscreen.js",
      "src-tauri/src/inject/title_bar.js",
      "src-tauri/src/inject/theme_refresh.js",
    ],
  },
  {
    name: "bundle",
    gates:
      "a real build in a fresh output directory on each affected OS (pnpm test, not --no-build), checking the CLI " +
      "JSON output path and the installer payload; Docker packaging for Linux bundles; restore build churn in tracked " +
      "Tauri config before committing",
    patterns: [
      "src-tauri/tauri.conf.json",
      "src-tauri/tauri.macos.conf.json",
      "src-tauri/tauri.windows.conf.json",
      "src-tauri/tauri.linux.conf.json",
      "src-tauri/Cargo.toml",
      "src-tauri/Info.plist",
      "src-tauri/entitlements.plist",
      "bin/builders/*",
      "Dockerfile",
    ],
  },
  {
    name: "cli-artifact",
    gates:
      "pnpm run cli:build and commit the regenerated dist/cli.js (Rollup inlines package.json); " +
      "npm pack --dry-run --ignore-scripts",
    patterns: ["package.json", "rollup.config.js"],
  },
];

export function matches(file, pattern) {
  return pattern.endsWith("/*")
    ? file.startsWith(pattern.slice(0, -1))
    : file === pattern;
}

function git(...args) {
  const out = spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
  return out.status === 0 ? out.stdout.split("\n").filter(Boolean) : [];
}

export function pendingPaths() {
  const base =
    (git("merge-base", "HEAD", "@{upstream}")[0] ??
      git("merge-base", "HEAD", "origin/main")[0]) ||
    "";
  const paths = new Set(base ? git("diff", "--name-only", base) : []);
  for (const file of git("ls-files", "--others", "--exclude-standard")) {
    paths.add(file);
  }
  return [...paths].sort();
}

export function tiersFor(paths) {
  return TIERS.map((tier) => ({
    ...tier,
    matched: paths.filter((file) =>
      tier.patterns.some((pattern) => matches(file, pattern)),
    ),
  })).filter((tier) => tier.matched.length > 0);
}

export function deadPatterns(
  tracked = git("ls-files", "--cached", "--others", "--exclude-standard"),
) {
  return TIERS.flatMap((tier) =>
    tier.patterns
      .filter((pattern) => !tracked.some((file) => matches(file, pattern)))
      .map((pattern) => `${tier.name}: ${pattern}`),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--self-check") {
    const dead = deadPatterns();
    for (const row of dead) console.log(`${row} matches no tracked file`);
    process.exit(dead.length ? 1 : 0);
  }
  const paths = args.length ? args : pendingPaths();
  for (const tier of tiersFor(paths)) {
    const more =
      tier.matched.length > 1 ? ` and ${tier.matched.length - 1} more` : "";
    console.log(
      `risk: ${tier.name} (${tier.matched[0]}${more}) needs ${tier.gates}`,
    );
  }
}
