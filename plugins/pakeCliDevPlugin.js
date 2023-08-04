import chalk from 'chalk';
import { spawn, exec } from 'child_process';

// just run in development mode
export default function pakeCliDevPlugin() {
  let devChildProcess;
  let cliChildProcess;

  let devHasStarted = false;

  return {
    name: 'pake-cli-dev-plugin',
    buildEnd() {

      const command = 'node';
      const cliCmdArgs = ['./dist/dev.js'];

      cliChildProcess = spawn(command, cliCmdArgs, { detached: true });

      cliChildProcess.stdout.on('data', (data) => {
        console.log(chalk.green(data.toString()));
      });

      cliChildProcess.stderr.on('data', (data) => {
        console.error(chalk.yellow(data.toString()));
      });

      cliChildProcess.on('close', async (code) => {
        console.log(chalk.yellow(`cli running end with code: ${code}`));
        if (devHasStarted) return;
        devHasStarted = true;
        devChildProcess = await exec('npm run tauri dev -- --config ./src-tauri/.pake/tauri.conf.json --features cli-build');

        devChildProcess.stdout.on('data', (data) => {
          console.log(chalk.green(data.toString()));
        });

        devChildProcess.stderr.on('data', (data) => {
          console.error(chalk.yellow(data.toString()));
        });

        devChildProcess.on('close', (code) => {
          console.log(chalk.yellow(`dev running end: ${code}`));
          process.exit(code);
        });
      });
    },
  };
}
