import path from "path";
import fs from "fs";
import appRootPath from "app-root-path";
import typescript from "rollup-plugin-typescript2";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import chalk from "chalk";
import { spawn, exec } from "child_process";

// Set macOS SDK environment variables for compatibility
if (process.platform === "darwin") {
  process.env.MACOSX_DEPLOYMENT_TARGET =
    process.env.MACOSX_DEPLOYMENT_TARGET || "14.0";
  process.env.CFLAGS = process.env.CFLAGS || "-fno-modules";
  process.env.CXXFLAGS = process.env.CXXFLAGS || "-fno-modules";
}

const isProduction = process.env.NODE_ENV === "production";
const devPlugins = !isProduction ? [pakeCliDevPlugin()] : [];

export default {
  input: isProduction ? "bin/cli.ts" : "bin/dev.ts",
  output: {
    file: isProduction ? "dist/cli.js" : "dist/dev.js",
    format: "es",
    sourcemap: !isProduction,
    banner: isProduction ? "#!/usr/bin/env node" : "",
  },
  watch: {
    include: "bin/**",
    exclude: "node_modules/**",
  },
  external: (id) => {
    if (id === "bin/cli.ts" || id === "bin/dev.ts") return false;
    if (id.startsWith(".") || path.isAbsolute(id) || id.startsWith("@/"))
      return false;
    return true;
  },
  onwarn(warning, warn) {
    if (warning.code === "UNRESOLVED_IMPORT") {
      return;
    }
    warn(warning);
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: !isProduction,
      inlineSources: !isProduction,
      noEmitOnError: false,
      compilerOptions: {
        target: "es2020",
        module: "esnext",
        moduleResolution: "node",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      },
    }),
    json(),
    commonjs(),
    replace({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      preventAssignment: true,
    }),
    alias({
      entries: [{ find: "@", replacement: path.join(appRootPath.path, "bin") }],
    }),
    ...devPlugins,
  ],
};

function pakeCliDevPlugin() {
  let devChildProcess;
  let cliChildProcess;

  let devHasStarted = false;

  // 智能检测包管理器
  const detectPackageManager = () => {
    if (fs.existsSync("pnpm-lock.yaml")) return "pnpm";
    if (fs.existsSync("yarn.lock")) return "yarn";
    return "npm";
  };

  return {
    name: "pake-cli-dev-plugin",
    buildEnd() {
      const command = "node";
      const cliCmdArgs = ["./dist/dev.js"];

      cliChildProcess = spawn(command, cliCmdArgs, { detached: true });

      cliChildProcess.stdout.on("data", (data) => {
        console.log(chalk.green(data.toString()));
      });

      cliChildProcess.stderr.on("data", (data) => {
        console.error(chalk.yellow(data.toString()));
      });

      cliChildProcess.on("close", async (code) => {
        console.log(chalk.yellow(`cli running end with code: ${code}`));
        if (devHasStarted) return;
        devHasStarted = true;

        const packageManager = detectPackageManager();
        const command = `${packageManager} run tauri dev -- --config ./src-tauri/.pake/tauri.conf.json --features cli-build`;

        devChildProcess = exec(command);

        devChildProcess.stdout.on("data", (data) => {
          console.log(chalk.green(data.toString()));
        });

        devChildProcess.stderr.on("data", (data) => {
          console.error(chalk.yellow(data.toString()));
        });

        devChildProcess.on("close", (code) => {
          console.log(chalk.yellow(`dev running end: ${code}`));
          process.exit(code);
        });
      });
    },
  };
}
