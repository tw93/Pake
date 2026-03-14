import crypto from 'crypto';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';

// Generates a stable identifier based on the app URL and name.
export function getIdentifier(url: string, name: string) {
  const postFixHash = crypto
    .createHash('md5')
    .update(`${url}::${name}`)
    .digest('hex')
    .substring(0, 6);
  return `com.pake.${postFixHash}`;
}

export function resolveIdentifier(
  url: string,
  name: string,
  customIdentifier?: string,
) {
  const trimmedIdentifier = customIdentifier?.trim();
  if (trimmedIdentifier) {
    return trimmedIdentifier;
  }

  return getIdentifier(url, name);
}

export async function promptText(
  message: string,
  initial?: string,
): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'content',
    message,
    initial,
  });
  return response.content;
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getSpinner(text: string) {
  const loadingType = {
    interval: 80,
    frames: ['✦', '✶', '✺', '✵', '✸', '✹', '✺'],
  };
  return ora({
    text: `${chalk.cyan(text)}\n`,
    spinner: loadingType,
    color: 'cyan',
  }).start();
}
