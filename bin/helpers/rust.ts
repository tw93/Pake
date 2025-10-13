import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { execaSync } from 'execa';

import { getSpinner } from '@/utils/info';
import { IS_WIN } from '@/utils/platform';
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';

function normalizePathForComparison(targetPath: string) {
  const normalized = path.normalize(targetPath);
  return IS_WIN ? normalized.toLowerCase() : normalized;
}

function getCargoHomeCandidates(): string[] {
  const candidates = new Set<string>();
  if (process.env.CARGO_HOME) {
    candidates.add(process.env.CARGO_HOME);
  }
  const homeDir = os.homedir();
  if (homeDir) {
    candidates.add(path.join(homeDir, '.cargo'));
  }
  if (IS_WIN && process.env.USERPROFILE) {
    candidates.add(path.join(process.env.USERPROFILE, '.cargo'));
  }
  return Array.from(candidates).filter(Boolean);
}

function ensureCargoBinOnPath() {
  const currentPath = process.env.PATH || '';
  const segments = currentPath.split(path.delimiter).filter(Boolean);
  const normalizedSegments = new Set(
    segments.map((segment) => normalizePathForComparison(segment)),
  );

  const additions: string[] = [];
  let cargoHomeSet = Boolean(process.env.CARGO_HOME);

  for (const cargoHome of getCargoHomeCandidates()) {
    const binDir = path.join(cargoHome, 'bin');
    if (
      fsExtra.pathExistsSync(binDir) &&
      !normalizedSegments.has(normalizePathForComparison(binDir))
    ) {
      additions.push(binDir);
      normalizedSegments.add(normalizePathForComparison(binDir));
    }

    if (!cargoHomeSet && fsExtra.pathExistsSync(cargoHome)) {
      process.env.CARGO_HOME = cargoHome;
      cargoHomeSet = true;
    }
  }

  if (additions.length) {
    const prefix = additions.join(path.delimiter);
    process.env.PATH = segments.length
      ? `${prefix}${path.delimiter}${segments.join(path.delimiter)}`
      : prefix;
  }
}

export function ensureRustEnv() {
  ensureCargoBinOnPath();
}

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
      300000,
      undefined,
      true,
    );
    spinner.succeed(chalk.green('✔ Rust installed successfully!'));
    ensureRustEnv();
  } catch (error) {
    spinner.fail(chalk.red('✕ Rust installation failed!'));
    console.error(error.message);
    process.exit(1);
  }
}

export function checkRustInstalled() {
  ensureCargoBinOnPath();
  try {
    execaSync('rustc', ['--version']);
    return true;
  } catch {
    return false;
  }
}
