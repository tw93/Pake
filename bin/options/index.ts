import { promptText } from '@/builders/common.js';
import { getDomain } from '@/utils/url.js';
import { getIdentifier } from '../helpers/tauriConfig.js';
import { PakeAppOptions, PakeCliOptions } from '../types.js';
import { handleIcon } from './icon.js';

export default async function handleOptions(options: PakeCliOptions, url: string): Promise<PakeAppOptions> {
  const appOptions: PakeAppOptions = {
    ...options,
    identifier: '',
  };

  if (!appOptions.name) {
    appOptions.name = await promptText('please input your application name', getDomain(url));
  }

  appOptions.identifier = getIdentifier(appOptions.name, url);

  appOptions.icon = await handleIcon(appOptions, url);

  return appOptions;
}
