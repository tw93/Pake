import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { PakeHistoryTarget } from '@/types';
import { getAppDataPaths } from '@/utils/app-data-paths';

/**
 * macOS-specific uninstall helpers.
 *
 * macOS artifacts are file-based (`.app` bundles and `.dmg` installers), so
 * removal is a direct filesystem operation. Missing paths are treated as
 * already-removed and only produce a warning so the uninstall can continue.
 */

/**
 * Remove the macOS app bundle and/or build artifact for a single target.
 *
 * @param target - The build target describing install_path and output_path.
 * @returns A promise that resolves when removal succeeds or paths are missing.
 */
export async function removeDarwinBinary(
  target: PakeHistoryTarget,
): Promise<void> {
  const paths: string[] = [];
  if (target.install_path) {
    paths.push(target.install_path);
  }
  paths.push(target.output_path);

  for (const filePath of paths) {
    if (await fsExtra.pathExists(filePath)) {
      await fsExtra.remove(filePath);
    } else {
      console.warn(
        chalk.yellow(`Path ${filePath} does not exist, skipping...`),
      );
    }
  }
}

/**
 * Remove the macOS config and/or cache directories for an app.
 *
 * @param productName - The app name as recorded in the registry.
 * @param categories - Flags selecting which data directories to remove.
 */
export async function removeDarwinData(
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
