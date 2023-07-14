import chalk from 'chalk';
import {spawn, exec} from 'child_process';


// just run in development mode
export default function pakeCliDevPlugin() {
  return {
    name: 'pake-cli-dev-plugin',
    buildEnd() {

      const command = 'node';
      const cliCmdArgs = ['./dist/dev.js'];
      const cliChildProcess = spawn(command, cliCmdArgs);

      cliChildProcess.stdout.on('data', (data) => {
        console.log(chalk.green(data.toString()));
      });

      cliChildProcess.stderr.on('data', (data) => {
        console.error(chalk.yellow(data.toString()));
      });

      cliChildProcess.on('close', async (code) => {
        console.log(chalk.yellow(`cli running end with code: ${code}`));
        cliChildProcess.kill();
        const dev = await exec('npm run tauri dev -- --config ./src-tauri/.pake/tauri.conf.json --features cli-build');

        dev.stdout.on('data', (data) => {
          console.error(chalk.green(data.toString()));
        });
  
        dev.stderr.on('data', (data) => {
          console.error(chalk.yellow(data.toString()));
        });

        dev.on('close', () => {
          dev.kill();
          console.log(chalk.green('rebuild start'));
        });
      });
    }
  }
}