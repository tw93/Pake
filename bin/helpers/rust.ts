import { IS_WIN } from '@/utils/platform.js';
import ora from 'ora';
import shelljs from 'shelljs';
import { shellExec } from '../utils/shell.js';

const RustInstallScriptFocMac =
  "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
const RustInstallScriptForWin = 'winget install --id Rustlang.Rustup';

export async function installRust() {
  const spinner = ora('Downloading Rust').start();
  try {
    await shellExec(IS_WIN ? RustInstallScriptForWin : RustInstallScriptFocMac);
    spinner.succeed();
  } catch (error) {
    console.error('install rust return code', error.message);
    spinner.fail();

    process.exit(1);
  }
}

export function checkRustInstalled() {
  return shelljs.exec('rustc --version', { silent: true }).code === 0;
}
