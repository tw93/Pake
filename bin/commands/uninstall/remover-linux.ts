import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { PakeHistoryTarget } from '@/types';
import { getAppDataPaths } from '@/utils/app-data-paths';
import { shellExec } from '@/utils/shell';
import { generateLinuxPackageName } from '@/utils/name';

function linuxPackageName(productName: string): string {
  const base = generateLinuxPackageName(productName);
  if (base.startsWith('pake-')) {
    return base;
  }
  return `pake-${base}`;
}

function commandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function removeLinuxBinary(
  productName: string,
  target: PakeHistoryTarget,
): Promise<void> {
  const packageName = linuxPackageName(productName);
  const errors: string[] = [];

  switch (target.format) {
    case 'deb':
      await shellExec(`sudo dpkg --remove ${packageName}`);
      return;
    case 'rpm':
      await shellExec(`sudo rpm --erase ${packageName}`);
      return;
    case 'zst':
      if (!commandExists('pacman')) {
        console.warn(
          chalk.yellow('pacman not found, skipping zst package removal'),
        );
        return;
      }
      await shellExec(`sudo pacman -R ${packageName}`);
      return;
    case 'appimage':
    case 'raw':
      try {
        if (await fsExtra.pathExists(target.output_path)) {
          await fsExtra.remove(target.output_path);
        } else {
          console.warn(
            chalk.yellow(
              `Path ${target.output_path} does not exist, skipping...`,
            ),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          chalk.yellow(`Failed to remove ${target.output_path}: ${message}`),
        );
        errors.push(message);
      }
      break;
    default:
      throw new Error(`Unsupported Linux format: ${target.format}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to remove ${errors.length} path(s): ${errors.join('; ')}`,
    );
  }
}

export async function removeLinuxData(
  productName: string,
  categories: { config: boolean; cache: boolean },
): Promise<void> {
  const paths = getAppDataPaths(productName);

  if (categories.config && (await fsExtra.pathExists(paths.config))) {
    await fsExtra.remove(paths.config);
  }

  if (categories.cache && (await fsExtra.pathExists(paths.cache))) {
    await fsExtra.remove(paths.cache);
  }
}
