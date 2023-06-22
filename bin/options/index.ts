import fsExtra from "fs-extra";

import { handleIcon } from './icon';
import { getDomain } from '@/utils/url';
import { getIdentifier, promptText } from '@/utils/info';
import { PakeAppOptions, PakeCliOptions } from '@/types';

export default async function handleOptions(options: PakeCliOptions, url: string): Promise<PakeAppOptions> {
  const appOptions: PakeAppOptions = {
    ...options,
    identifier: getIdentifier(url),
  };

  let urlExists = await fsExtra.pathExists(url);

  if (!appOptions.name) {
    const defaultName = urlExists ? "" : getDomain(url);
    const promptMessage = 'Enter your application name';
    appOptions.name = await promptText(promptMessage, defaultName);
  }

  appOptions.icon = await handleIcon(appOptions);

  return appOptions;
}
