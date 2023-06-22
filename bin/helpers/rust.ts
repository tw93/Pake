import ora from 'ora';
import shelljs from 'shelljs';

import { IS_WIN } from '@/utils/platform';
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';

export async function installRust() {
  const isInChina = await isChinaDomain("sh.rustup.rs");
  const rustInstallScriptForMac = isInChina
    ? 'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh'
    : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
  const rustInstallScriptForWindows = 'winget install --id Rustlang.Rustup';

  const spinner = ora('Downloading Rust').start();

  try {
    await shellExec(IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac);
    spinner.succeed();
  } catch (error) {
    console.error('Error installing Rust:', error.message);
    spinner.fail();

    //@ts-ignore
    process.exit(1);
  }
}

export function checkRustInstalled() {
  return shelljs.exec('rustc --version', { silent: true }).code === 0;
}
