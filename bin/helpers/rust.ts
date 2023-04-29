import { IS_WIN } from '@/utils/platform.js';
import ora from 'ora';
import shelljs from 'shelljs';
import logger from '@/options/logger.js';
import { shellExec } from '../utils/shell.js';
import {isChinaDomain} from '@/utils/ip_addr.js'


export async function installRust() {
  const is_china = await isChinaDomain("sh.rustup.rs");
  let RustInstallScriptFocMac = "";
  if (is_china) {
    logger.info("it's in China, use rust cn mirror to install rust");
    RustInstallScriptFocMac =
      'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh';
  } else {
    RustInstallScriptFocMac =
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
  }
  const RustInstallScriptForWin = 'winget install --id Rustlang.Rustup';
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
