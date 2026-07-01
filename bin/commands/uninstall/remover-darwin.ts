import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { PakeHistoryTarget } from '@/types';
import { getAppDataPaths } from '@/utils/app-data-paths';

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
