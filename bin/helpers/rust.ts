import chalk from 'chalk';
import shelljs from 'shelljs';

import { getSpinner } from '@/utils/info';
import { IS_WIN } from '@/utils/platform';
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';

export async function installRust() {
  const isActions = process.env.GITHUB_ACTIONS;
  const isInChina = await isChinaDomain('sh.rustup.rs');
  const rustInstallScriptForMac =
    isInChina && !isActions
      ? 'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh'
      : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
  const rustInstallScriptForWindows = 'winget install --id Rustlang.Rustup';

  const spinner = getSpinner('Downloading Rust...');

  try {
    await shellExec(IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac);
    spinner.succeed(chalk.green('Rust installed successfully!'));
  } catch (error) {
    console.error('Error installing Rust:', error.message);
    spinner.fail(chalk.red('Rust installation failed!'));
    process.exit(1);
  }
}

export function checkRustInstalled() {
  return shelljs.exec('rustc --version', { silent: true }).code === 0;
}
