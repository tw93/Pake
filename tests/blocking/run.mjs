#!/usr/bin/env node
// Runs the built-in ad blocking on real pages before a runtime release that
// changes the filter lists or their conversion (docs/incidents.md I-23, I-24).
// Each page of sites.txt is loaded in an offscreen WKWebView three times: with
// no blocking, with the two WebKit lists a Mac or Linux app compiles, and with
// the hiding script a Windows app injects. A page that loses its icons, most of
// its elements or most of its text under either fails the run.
//
//   node tests/blocking/run.mjs            every page of sites.txt
//   node tests/blocking/run.mjs <url>...   only these pages
//
// macOS only, and it needs the network. A page that does not load without
// blocking either is listed as not covered and does not fail the run.
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const PARALLEL = 4;
const ROUNDS = 3;

// What counts as a page that lost its content. Pages change between two loads,
// so each limit sits far from what an ad or a banner removes.
export function verdict(off, on) {
  if (on.error) return `did not load (${on.error})`;
  const hidden = (page) => (page.svg ? page.svgHidden / page.svg : 0);
  if (on.svg >= 3 && hidden(on) > 0.5 && hidden(off) < 0.2) {
    return `${on.svgHidden} of ${on.svg} svg hidden, ${off.svgHidden} of ${off.svg} without blocking`;
  }
  if (off.visible > 50 && on.visible < off.visible * 0.5) {
    return `${on.visible} visible elements, ${off.visible} without blocking`;
  }
  // A cookie notice is half the text of a short landing page (grok.com,
  // perplexity.ai), so only a page with a body of text is held to this.
  if (off.text > 1500 && on.text < off.text * 0.4) {
    return `${on.text} characters of text, ${off.text} without blocking`;
  }
  return "";
}

function probe(bin, env, url, extra) {
  return new Promise((resolve) => {
    execFile(
      bin,
      [url, ...extra],
      { env: { ...process.env, ...env }, timeout: 120_000 },
      (_error, stdout) => {
        const line = stdout.trim().split("\n").pop() || "";
        try {
          resolve(JSON.parse(line));
        } catch {
          resolve({ error: "no report" });
        }
      },
    );
  });
}

async function main() {
  if (process.platform !== "darwin") {
    console.error("tests/blocking/run.mjs runs on macOS only");
    process.exit(2);
  }
  const { fetched } = JSON.parse(
    readFileSync(join(root, "filters/sources.json"), "utf8"),
  );
  const age = Math.floor((Date.now() - Date.parse(fetched)) / 86_400_000);
  console.log(
    `filter lists fetched ${fetched}, ${age} days ago` +
      (age > 14 ? "; run scripts/update-filter-lists.mjs first" : ""),
  );
  const work = mkdtempSync(join(tmpdir(), "pake-blocking-"));
  try {
    const bin = join(work, "probe");
    execFileSync("swiftc", ["-O", join(here, "probe.swift"), "-o", bin], {
      stdio: "inherit",
    });
    execFileSync(
      "cargo",
      [
        "test",
        "--lib",
        "--features",
        "content-blocking",
        "dump_for_real_pages",
        "--",
        "--ignored",
      ],
      {
        cwd: join(root, "src-tauri"),
        env: { ...process.env, PAKE_DUMP_BLOCKING: work },
        stdio: ["ignore", "ignore", "inherit"],
      },
    );
    const env = { PROBE_STORE: join(work, "store") };
    const modes = {
      webkit: [
        "--list",
        join(work, "network.json"),
        "--list",
        join(work, "cosmetic.json"),
      ],
      windows: ["--script", join(work, "windows.js")],
    };

    // The run first shows it can see a broken conversion: a list that hides
    // every svg, which is what I-23 shipped, has to fail on a page with icons.
    const broken = join(work, "broken.json");
    writeFileSync(
      broken,
      JSON.stringify([
        {
          trigger: { "url-filter": ".*" },
          action: { type: "css-display-none", selector: "svg" },
        },
      ]),
    );
    const control = "https://github.com/";
    const controlOff = await probe(bin, env, control, []);
    const controlOn = await probe(bin, env, control, ["--list", broken]);
    if (controlOff.error || !verdict(controlOff, controlOn)) {
      console.error(
        `the control did not fail: ${JSON.stringify(controlOff)} ${JSON.stringify(controlOn)}`,
      );
      process.exit(2);
    }
    // Compiles the two real lists once, before pages run side by side.
    const warm = await probe(bin, env, "https://example.com/", modes.webkit);
    if (warm.error) {
      console.error(`the lists did not compile or load: ${warm.error}`);
      process.exit(2);
    }
    const script = await probe(bin, env, "https://example.com/", modes.windows);
    if (!script.styles) {
      console.error("the Windows script attached no style to a plain page");
      process.exit(1);
    }

    const sites = process.argv.slice(2).length
      ? process.argv.slice(2)
      : readFileSync(join(here, "sites.txt"), "utf8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));
    const failed = [];
    const uncovered = [];
    const queue = [...sites];
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        // Some pages come in two shapes from one load to the next (notion.so,
        // a Bing search), so a page that differs is loaded again, without and
        // with blocking, and fails only when it differs every time.
        let bad = "";
        let covered = false;
        for (let round = 0; round < ROUNDS; round++) {
          const off = await probe(bin, env, url, []);
          if (off.error) {
            bad = off.error;
            continue;
          }
          covered = true;
          bad = "";
          for (const [mode, extra] of Object.entries(modes)) {
            const why = verdict(off, await probe(bin, env, url, extra));
            if (why) bad += `${bad ? "; " : ""}${mode}: ${why}`;
          }
          if (!bad) break;
        }
        if (!covered) {
          uncovered.push(`${url} (${bad})`);
          console.log(`not covered  ${url}`);
          continue;
        }
        if (bad) failed.push(`${url}  ${bad}`);
        console.log(`${bad ? "FAILED     " : "ok         "}  ${url}  ${bad}`);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    const covered = sites.length - uncovered.length;
    console.log(
      `\n${covered} of ${sites.length} pages covered, ${failed.length} failed`,
    );
    for (const line of uncovered) console.log(`not covered: ${line}`);
    for (const line of failed) console.log(`failed: ${line}`);
    if (failed.length || covered < sites.length * 0.8) process.exit(1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
