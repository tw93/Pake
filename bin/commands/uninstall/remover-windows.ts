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

export function lookupWindowsProductCode(productName: string): string | undefined {
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

export async function removeWindowsBinary(
  productName: string,
  target: PakeHistoryTarget,
): Promise<void> {
  const productCode = lookupWindowsProductCode(productName);

  if (productCode) {
    await shellExec(`msiexec /x ${productCode} /qn /norestart`);
    return;
  }

  if (await fsExtra.pathExists(target.output_path)) {
    await fsExtra.remove(target.output_path);
  } else {
    console.warn(chalk.yellow(`Path ${target.output_path} does not exist, skipping...`));
  }
}

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
