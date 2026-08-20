import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function renderStyles(dragRegionHeight) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/inject/style.js"),
    "utf8",
  );
  const listeners = {};
  const children = [];
  const context = {
    hasImmersiveHeader: () => true,
    navigator: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
    },
    window: {
      pakeConfig: {
        hide_title_bar: true,
        ...(dragRegionHeight === undefined
          ? {}
          : { drag_region_height: dragRegionHeight }),
      },
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    document: {
      createElement: () => ({ textContent: "" }),
      head: {
        appendChild(child) {
          children.push(child);
        },
      },
    },
  };
  context.window.navigator = context.navigator;
  runInNewContext(source, context);
  listeners.DOMContentLoaded();
  return children.map((child) => child.textContent).join("\n");
}

describe("immersive drag region height", () => {
  it("uses the upstream-compatible 20px default", () => {
    expect(renderStyles(undefined)).toContain("height: 20px");
  });

  it("uses custom and zero-height values", () => {
    expect(renderStyles(10)).toContain("height: 10px");
    expect(renderStyles(0)).toContain("height: 0px");
  });
});
