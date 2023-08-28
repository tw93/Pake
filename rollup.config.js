import path from 'path';
import appRootPath from 'app-root-path';
import typescript from 'rollup-plugin-typescript2';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import chalk from 'chalk';
import { spawn, exec } from 'child_process';

const isProduction = process.env.NODE_ENV === 'production';
const devPlugins = !isProduction ? [pakeCliDevPlugin()] : [];

export default {
  input: isProduction ? 'bin/cli.ts' : 'bin/dev.ts',
  output: {
    file: isProduction ? 'dist/cli.js' : 'dist/dev.js',
    format: 'es',
    sourcemap: !isProduction,
  },
  watch: {
    include: 'bin/**',
    exclude: 'node_modules/**',
  },
  plugins: [
    json(),
    typescript({
      tsconfig: 'tsconfig.json',
      clean: true, // Clear cache
    }),
    commonjs(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      preventAssignment: true,
    }),
    alias({
      entries: [{ find: '@', replacement: path.join(appRootPath.path, 'bin') }],
    }),
    ...devPlugins,
  ],
};

function pakeCliDevPlugin() {
  let devChildProcess;
  let cliChildProcess;

  let devHasStarted = false;

  return {
    name: 'pake-cli-dev-plugin',
    buildEnd() {
      const command = 'node';
      const cliCmdArgs = ['./dist/dev.js'];

      cliChildProcess = spawn(command, cliCmdArgs, { detached: true });

      cliChildProcess.stdout.on('data', data => {
        console.log(chalk.green(data.toString()));
      });

      cliChildProcess.stderr.on('data', data => {
        console.error(chalk.yellow(data.toString()));
      });

      cliChildProcess.on('close', async code => {
        console.log(chalk.yellow(`cli running end with code: ${code}`));
        if (devHasStarted) return;
        devHasStarted = true;
        devChildProcess = await exec(
          'npm run tauri dev -- --config ./src-tauri/.pake/tauri.conf.json --features cli-build',
        );

        devChildProcess.stdout.on('data', data => {
          console.log(chalk.green(data.toString()));
        });

        devChildProcess.stderr.on('data', data => {
          console.error(chalk.yellow(data.toString()));
        });

        devChildProcess.on('close', code => {
          console.log(chalk.yellow(`dev running end: ${code}`));
          process.exit(code);
        });
      });
    },
  };
}
