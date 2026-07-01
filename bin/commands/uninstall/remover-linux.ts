import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { PakeHistoryTarget } from '@/types';
import { getAppDataPaths } from '@/utils/app-data-paths';
import { shellExec } from '@/utils/shell';
import { generateLinuxPackageName } from '@/utils/name';

/**
 * Linux-specific uninstall helpers.
 *
 * Package-managed targets (deb, rpm, zst) are removed through the native package
 * manager so that desktop entries, icons, and dependencies are cleaned up
 * properly. File-based targets (AppImage, raw binary) are removed directly.
 *
 * Package-manager failures are allowed to propagate and abort the uninstall
 * flow, which prevents config/cache directories from being deleted while a
 * package-managed binary may still be registered with the system.
 */

/**
 * Build the Linux package name used at build time.
 *
 * Reuses {@link generateLinuxPackageName} so that the uninstall command targets
 * the exact package that `LinuxBuilder` / `BaseBuilder` created.
 */
function linuxPackageName(productName: string): string {
  const base = generateLinuxPackageName(productName);
  if (base.startsWith('pake-')) {
    return base;
  }
  return `pake-${base}`;
}

/**
 * Check whether a command is available in the current shell.
 *
 * Uses `command -v` instead of `which` because `which` is not guaranteed to be
 * installed on minimal Linux distributions.
 */
function commandExists(command: string): boolean {
  try {
    execSync(`command -v ${command} >/dev/null 2>&1`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the Linux binary or package for a single build target.
 *
 * @param productName - The app name as recorded in the registry.
 * @param target - The build target describing what was built and where.
 * @returns A promise that resolves when removal succeeds.
 * @throws When a package-manager command fails or a file removal fails.
 */
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

/**
 * Remove the Linux config and/or cache directories for an app.
 *
 * @param productName - The app name as recorded in the registry.
 * @param categories - Flags selecting which data directories to remove.
 */
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
