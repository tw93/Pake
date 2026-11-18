import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/bridge.js"),
  "utf-8",
);

function load(internals) {
  const window = {};
  if (internals) window.__TAURI_INTERNALS__ = internals;
  vm.runInNewContext(source, { window });
  return window;
}

describe("Pake's native bridge", () => {
  it("leaves no Tauri global API name for a page to find", () => {
    const window = load({ invoke: () => Promise.resolve() });

    expect("__TAURI__" in window).toBe(false);
    expect(Object.keys(window)).toEqual(["__TAURI_INTERNALS__"]);
    expect(typeof window.__PAKE_NATIVE__.core.invoke).toBe("function");
  });

  it("is the only way Pake's injected scripts reach the native side", () => {
    const dir = path.join(process.cwd(), "src-tauri/src/inject");
    const scripts = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".js") && name !== "custom.js");

    expect(scripts.length).toBeGreaterThan(10);
    for (const name of scripts) {
      const script = fs.readFileSync(path.join(dir, name), "utf-8");
      expect(script.includes("__TAURI__"), name).toBe(false);
    }
    const conf = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "src-tauri/tauri.conf.json"),
        "utf-8",
      ),
    );
    expect(conf.app.withGlobalTauri).toBe(false);
  });

  it("sends the window commands Tauri's own API sends", async () => {
    const calls = [];
    const window = load({
      metadata: { currentWindow: { label: "pake-2" } },
      invoke: (command, args) => {
        calls.push([command, args]);
        return Promise.resolve(command.endsWith("is_fullscreen"));
      },
    });
    const appWindow = window.__PAKE_NATIVE__.window.getCurrentWindow();

    await appWindow.startDragging();
    await appWindow.setFullscreen(false);
    await appWindow.close();
    expect(await appWindow.isFullscreen()).toBe(true);
    await appWindow.toggleMaximize();
    await appWindow.maximize();
    await appWindow.minimize();
    await appWindow.setResizable(true);
    await appWindow.theme();
    await window.__PAKE_NATIVE__.shell.open("https://example.com");
    await window.__PAKE_NATIVE__.core.invoke("set_zoom", { percent: 90 });

    expect(calls).toEqual([
      ["plugin:window|start_dragging", { label: "pake-2" }],
      ["plugin:window|set_fullscreen", { label: "pake-2", value: false }],
      ["plugin:window|close", { label: "pake-2" }],
      ["plugin:window|is_fullscreen", { label: "pake-2" }],
      ["plugin:window|toggle_maximize", { label: "pake-2" }],
      ["plugin:window|maximize", { label: "pake-2" }],
      ["plugin:window|minimize", { label: "pake-2" }],
      ["plugin:window|set_resizable", { label: "pake-2", value: true }],
      ["plugin:window|theme", { label: "pake-2" }],
      ["plugin:shell|open", { path: "https://example.com", with: undefined }],
      ["set_zoom", { percent: 90 }],
    ]);
  });

  it("rejects instead of throwing where the page has no native side", async () => {
    const window = load();

    await expect(
      window.__PAKE_NATIVE__.core.invoke("set_zoom", { percent: 90 }),
    ).rejects.toThrow("native bridge unavailable");
  });
});
