import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/title_bar.js"),
  "utf-8",
);

// Colors are written as "r,g,b,a" so the fake canvas can resolve them without
// a real CSS parser; anything else behaves like an unsupported value.
function parse(value) {
  const parts = String(value).split(",").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isFinite(n))
    ? parts
    : null;
}

function element(background, parentElement = null) {
  return { background, parentElement };
}

function loadTitleBar({ columns, width = 1000 }) {
  const calls = [];
  let current = columns;
  let timer = null;
  let observed = null;
  const context = {
    console,
    setTimeout: (callback) => {
      timer = callback;
      return 1;
    },
    setInterval: () => 0,
    MutationObserver: class {
      constructor(callback) {
        observed = callback;
      }
      observe() {}
    },
    document: {
      readyState: "complete",
      documentElement: {},
      body: {},
      addEventListener() {},
      createElement() {
        let fill = [0, 0, 0, 0];
        return {
          getContext: () => ({
            clearRect() {},
            fillRect() {},
            set fillStyle(value) {
              const parsed = parse(value);
              if (parsed) fill = parsed;
            },
            getImageData: () => ({ data: fill }),
          }),
        };
      },
      elementFromPoint(x) {
        const column = Math.min(2, Math.floor((x / width) * 3));
        return current[column];
      },
    },
    window: {
      innerWidth: width,
      addEventListener() {},
      getComputedStyle: (node) => ({ backgroundColor: node.background }),
      __TAURI__: {
        core: {
          invoke(command, args) {
            calls.push({ command, args });
            return Promise.resolve();
          },
        },
      },
    },
  };
  context.window.document = context.document;
  runInNewContext(source, context);
  return {
    calls,
    // A page mutation followed by the debounce timer firing.
    repaint(next) {
      current = next;
      observed();
      const run = timer;
      timer = null;
      run?.();
    },
  };
}

describe("macOS transparent title bar color", () => {
  it("sends the color most of the top edge shares", () => {
    const white = element("255,255,255,255");
    const logo = element("240,240,240,255");
    const { calls } = loadTitleBar({ columns: [white, logo, white] });
    expect(calls).toEqual([
      {
        command: "set_title_bar_color",
        args: { red: 255, green: 255, blue: 255 },
      },
    ]);
  });

  it("walks up past transparent layers to the painted ancestor", () => {
    const page = element("20,20,24,255");
    const overlay = element("0,0,0,0", page);
    const { calls } = loadTitleBar({ columns: [overlay, overlay, overlay] });
    expect(calls[0].args).toEqual({ red: 20, green: 20, blue: 24 });
  });

  it("uses the center sample when all three differ", () => {
    const { calls } = loadTitleBar({
      columns: [
        element("10,10,10,255"),
        element("200,100,50,255"),
        element("90,90,90,255"),
      ],
    });
    expect(calls[0].args).toEqual({ red: 200, green: 100, blue: 50 });
  });

  it("sends again only when the top color changes", () => {
    const white = element("255,255,255,255");
    const { calls, repaint } = loadTitleBar({ columns: [white, white, white] });
    repaint([white, white, white]);
    expect(calls).toHaveLength(1);
    const dark = element("30,30,30,255");
    repaint([dark, dark, dark]);
    expect(calls.map((call) => call.args.red)).toEqual([255, 30]);
  });

  it("leaves the native color alone when nothing on top is painted", () => {
    const clear = element("0,0,0,0");
    const { calls } = loadTitleBar({ columns: [clear, clear, null] });
    expect(calls).toEqual([]);
  });
});
