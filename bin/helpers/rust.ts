import chalk from 'chalk';
import { execaSync } from 'execa';

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
    await shellExec(
      IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac,
    );
    spinner.succeed(chalk.green('✔ Rust installed successfully!'));
  } catch (error) {
    spinner.fail(chalk.red('✕ Rust installation failed!'));
    console.error(error.message);
    process.exit(1);
  }
}

export function checkRustInstalled() {
  try {
    execaSync('rustc', ['--version']);
    return true;
  } catch {
    return false;
  }
}
