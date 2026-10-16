// Exercises the shipped CLI with a deterministic compiler stand-in. Native
// compilation is verified separately; this checks actual staging and copying.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

if (!["darwin", "linux"].includes(process.platform))
  throw new Error(
    "This artifact fixture covers macOS .app and Linux .deb paths.",
  );
const isMac = process.platform === "darwin";
const exec = promisify(execFile);
const repo = process.cwd();
const root = await fs.mkdtemp(
  path.join(os.tmpdir(), "pake-cli-workspace-test-"),
);
const pkg = path.join(root, "package");
const cache = path.join(root, "cache");
const buildScript = `
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = JSON.parse(fs.readFileSync('src-tauri/.pake/tauri.conf.json'));
const name = config.productName;
const id = name.toLowerCase();
const snapshot = {
  name, directory: process.cwd(),
  html: fs.readFileSync('dist/index.html', 'utf8'),
  custom: fs.readFileSync('src-tauri/src/inject/custom.js', 'utf8'),
};
if (id === 'fail') process.exit(9);
if (id.startsWith('cancel')) {
  const writes = path.join(process.env.PAKE_FIXTURE_ROOT, id + '-writes');
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>require("fs").appendFileSync(process.argv[1],"x"),10)', writes], {stdio:'ignore'});
  process.on('SIGTERM', () => {});
  fs.writeFileSync(path.join(process.env.PAKE_FIXTURE_ROOT, id + '-ready.json'), JSON.stringify({directory:process.cwd(),pid:process.pid,child:child.pid}));
  setInterval(() => {}, 10000);
} else setTimeout(() => {
  const target = process.env.CARGO_TARGET_DIR;
  const arm = process.arch === 'arm64';
  const output = process.platform === 'darwin'
    ? path.join(target, (arm ? 'aarch64' : 'x86_64') + '-apple-darwin', 'release', 'bundle', 'macos', name + '.app', 'snapshot.json')
    : path.join(target, ...(arm ? ['aarch64-unknown-linux-gnu'] : []), 'release', 'bundle', 'deb', name + '_' + config.version + '_' + (arm ? 'arm64' : 'amd64') + '.deb');
  fs.mkdirSync(path.dirname(output), {recursive:true});
  fs.writeFileSync(output, JSON.stringify(snapshot));
}, 100);
`;

try {
  await fs.mkdir(path.join(pkg, "dist"), { recursive: true });
  await fs.copyFile(
    process.env.PAKE_CLI_SOURCE || path.join(repo, "dist/cli.js"),
    path.join(pkg, "dist/cli.js"),
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(repo, "package.json"), "utf8"),
  );
  manifest.scripts.build = "node src-tauri/fixture.cjs";
  await fs.writeFile(path.join(pkg, "package.json"), JSON.stringify(manifest));
  await fs.cp(path.join(repo, "src-tauri"), path.join(pkg, "src-tauri"), {
    recursive: true,
    filter: (file) =>
      !["target", ".pake", "gen", ".cargo"].includes(
        path.relative(path.join(repo, "src-tauri"), file).split(path.sep)[0],
      ),
  });
  await fs.writeFile(path.join(pkg, "src-tauri/fixture.cjs"), buildScript);
  await fs.symlink(
    path.join(repo, "node_modules"),
    path.join(pkg, "node_modules"),
    "dir",
  );
  const customTemplate = await fs.readFile(
    path.join(pkg, "src-tauri/src/inject/custom.js"),
    "utf8",
  );
  const sourceConfig = await fs.readFile(
    path.join(pkg, "src-tauri/tauri.conf.json"),
    "utf8",
  );
  async function build(name, signal) {
    const input = path.join(root, name);
    await fs.mkdir(input);
    await fs.writeFile(path.join(input, "index.html"), name);
    await fs.writeFile(
      path.join(input, "custom.js"),
      `window.fixture = ${JSON.stringify(name)};`,
    );
    const running = exec(
      process.execPath,
      [
        path.join(pkg, "dist/cli.js"),
        input,
        "--name",
        name,
        "--targets",
        isMac ? "app" : "deb",
        "--json",
        "--icon",
        path.join(
          repo,
          isMac ? "src-tauri/icons/icon.icns" : "src-tauri/icons/icon.png",
        ),
        "--inject",
        path.join(input, "custom.js"),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          CI: "true",
          CARGO_TARGET_DIR: cache,
          PAKE_FIXTURE_ROOT: root,
        },
        timeout: 30_000,
      },
    );
    if (signal === "WAIT") {
      running.catch(() => {});
      let waiting = false;
      running.child.stderr.on("data", (data) => {
        if (data.toString().includes("Waiting for another Pake build"))
          waiting = true;
      });
      const deadline = Date.now() + 10000;
      while (!waiting && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 25));
      assert.ok(waiting, "CLI did not reach cache wait");
      running.child.kill("SIGINT");
    } else if (signal) {
      running.catch(() => {});
      const ready = path.join(root, name.toLowerCase() + "-ready.json");
      const started = Date.now();
      for (;;) {
        try {
          await fs.access(ready);
          break;
        } catch {}
        if (Date.now() - started > 20000)
          throw new Error("Compiler fixture did not start.");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      // Wait until the descendant has installed its TERM handler and written.
      const writes = path.join(root, name.toLowerCase() + "-writes");
      for (;;) {
        try {
          await fs.access(writes);
          break;
        } catch {}
        if (Date.now() - started > 20000)
          throw new Error("Compiler descendant did not start.");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      running.child.kill(signal);
    }
    return running;
  }
  await fs.mkdir(cache, { recursive: true });
  const ownedLock = path.join(cache, ".pake-build.lock");
  await fs.writeFile(ownedLock, String(process.pid));
  try {
    await assert.rejects(build("Waiting", "WAIT"), (error) => {
      assert.equal(JSON.parse(error.stdout).error.code, "BUILD_FAILED");
      return true;
    });
    assert.equal(
      await fs.readFile(ownedLock, "utf8"),
      String(process.pid),
      "A cancelled waiter must not remove the owner's lock",
    );
  } finally {
    await fs.unlink(ownedLock);
  }
  const outcomes = await Promise.all([build("Alpha"), build("Beta")]);
  for (const [index, name] of ["Alpha", "Beta"].entries()) {
    const result = JSON.parse(outcomes[index].stdout);
    assert.equal(result.ok, true);
    const artifact = isMac
      ? path.join(root, `${name}.app`)
      : path.join(root, `${name.toLowerCase()}.deb`);
    assert.equal(
      await fs.realpath(result.outputs[0].path),
      await fs.realpath(artifact),
    );
    const snapshot = JSON.parse(
      await fs.readFile(
        isMac ? path.join(artifact, "snapshot.json") : artifact,
        "utf8",
      ),
    );
    assert.equal(snapshot.html, name);
    assert.match(snapshot.custom, new RegExp(name));
    assert.notEqual(snapshot.directory, pkg);
    await assert.rejects(fs.access(snapshot.directory));
  }
  await assert.rejects(build("Fail"), (error) => {
    assert.equal(JSON.parse(error.stdout).ok, false);
    assert.equal(error.code, 3);
    return true;
  });
  const recovery = await build("Recovery");
  assert.equal(JSON.parse(recovery.stdout).ok, true);
  for (const [name, signal] of [
    ["CancelInt", "SIGINT"],
    ["CancelTerm", "SIGTERM"],
  ]) {
    await assert.rejects(build(name, signal), (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "BUILD_FAILED");
      assert.match(result.error.message, new RegExp(signal));
      assert.equal(error.code, 3);
      return true;
    });
    const ready = JSON.parse(
      await fs.readFile(
        path.join(root, name.toLowerCase() + "-ready.json"),
        "utf8",
      ),
    );
    await assert.rejects(fs.access(ready.directory));
    await assert.rejects(fs.access(path.join(cache, ".pake-build.lock")));
    const writes = path.join(root, name.toLowerCase() + "-writes");
    const size = (await fs.stat(writes)).size;
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      (await fs.stat(writes)).size,
      size,
      "Compiler must stop before cleanup finishes.",
    );
    assert.equal(JSON.parse((await build("After" + name)).stdout).ok, true);
  }
  assert.equal(
    await fs.readFile(path.join(pkg, "src-tauri/src/inject/custom.js"), "utf8"),
    customTemplate,
  );
  assert.equal(
    await fs.readFile(path.join(pkg, "src-tauri/tauri.conf.json"), "utf8"),
    sourceConfig,
  );
  assert.deepEqual(await fs.readdir(path.join(pkg, "dist")), ["cli.js"]);
  await assert.rejects(fs.access(path.join(pkg, "src-tauri/.pake")));
  await assert.rejects(fs.access(path.join(cache, ".pake-build.lock")));
  console.log(
    "PASS: concurrent inputs, shipped CLI artifacts, failed-build cleanup, SIGINT/SIGTERM descendant shutdown, next-build recovery, unchanged installation",
  );
} finally {
  for (const name of ["CancelInt", "CancelTerm"]) {
    try {
      const ready = JSON.parse(
        await fs.readFile(
          path.join(root, name.toLowerCase() + "-ready.json"),
          "utf8",
        ),
      );
      for (const pid of [ready.pid, ready.child]) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    } catch {}
  }
  await fs.rm(root, { recursive: true, force: true });
}
