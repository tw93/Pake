import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { PakeHistoryTarget } from '@/types';
import { getAppDataPaths } from '@/utils/app-data-paths';
import { shellExec } from '@/utils/shell';

const REGISTRY_ROOTS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

/**
 * Windows-specific uninstall helpers.
 *
 * Windows MSI targets are uninstalled through `msiexec /x` using the
 * ProductCode stored in the registry. Non-MSI artifacts are removed as files.
 * The registry is only read, never modified, and lookup failures fall back to
 * direct file removal so that already-uninstalled apps do not block the flow.
 */

/**
 * Look up the MSI ProductCode for an installed app by its DisplayName.
 *
 * Searches both the native and WOW6432Node uninstall registry hives so that
 * 32-bit installers are found on 64-bit Windows.
 *
 * @param productName - The display name of the app to look up.
 * @returns The ProductCode GUID if found, otherwise `undefined`.
 */
export function lookupWindowsProductCode(
  productName: string,
): string | undefined {
  for (const root of REGISTRY_ROOTS) {
    try {
      const output = execSync(`reg query "${root}" /s /v DisplayName`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const lines = output.split(/\r?\n/);
      let currentKey: string | null = null;

      for (const line of lines) {
        const keyMatch = line.match(/^HKEY_LOCAL_MACHINE\\(.+)$/);
        if (keyMatch) {
          currentKey = keyMatch[1];
          continue;
        }

        const displayNameMatch = line.match(/DisplayName\s+REG_SZ\s+(.+)$/);
        if (
          displayNameMatch &&
          displayNameMatch[1].trim() === productName &&
          currentKey
        ) {
          const guidMatch = currentKey.match(/{[A-F0-9-]+}/i);
          if (guidMatch) {
            return guidMatch[0];
          }
        }
      }
    } catch {
      // Registry root may not exist or be inaccessible; continue to next root.
    }
  }

  return undefined;
}

/**
 * Remove the Windows binary or MSI installation for a single build target.
 *
 * @param productName - The app name as recorded in the registry.
 * @param target - The build target describing what was built and where.
 * @returns A promise that resolves when removal succeeds.
 * @throws When `msiexec` fails or file removal fails.
 */
export async function removeWindowsBinary(
  productName: string,
  target: PakeHistoryTarget,
): Promise<void> {
  if (target.format !== 'msi') {
    if (await fsExtra.pathExists(target.output_path)) {
      await fsExtra.remove(target.output_path);
    } else {
      console.warn(
        chalk.yellow(`Path ${target.output_path} does not exist, skipping...`),
      );
    }
    return;
  }

  const productCode = lookupWindowsProductCode(productName);

  if (productCode) {
    await shellExec(`msiexec /x ${productCode} /qn /norestart`);
    return;
  }

  if (await fsExtra.pathExists(target.output_path)) {
    await fsExtra.remove(target.output_path);
  } else {
    console.warn(
      chalk.yellow(`Path ${target.output_path} does not exist, skipping...`),
    );
  }
}

/**
 * Remove the Windows config and/or cache directories for an app.
 *
 * @param productName - The app name as recorded in the registry.
 * @param categories - Flags selecting which data directories to remove.
 */
export async function removeWindowsData(
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
