import { promptText } from '@/builders/common.js';
import { getDomain } from '@/utils/url.js';
import { getIdentifier } from '../helpers/tauriConfig.js';
import { PakeAppOptions, PakeCliOptions } from '../types.js';
import { handleIcon } from './icon.js';
import fs from 'fs/promises';

export default async function handleOptions(options: PakeCliOptions, url: string): Promise<PakeAppOptions> {
  const appOptions: PakeAppOptions = {
    ...options,
    identifier: '',
  };
  const url_exists = await fs.stat(url)
    .then(() => true)
    .catch(() => false);
  if (!appOptions.name) {
    if (!url_exists) {
      appOptions.name = await promptText('please input your application name', getDomain(url));
    } else {
      appOptions.name = await promptText('please input your application name', "");
    }
  }

  appOptions.identifier = getIdentifier(appOptions.name, url);

  appOptions.icon = await handleIcon(appOptions, url);

  return appOptions;
}
