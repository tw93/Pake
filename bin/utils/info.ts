import crypto from 'crypto';
import prompts from "prompts";
import ora from "ora";
import chalk from 'chalk';

// Generates an identifier based on the given URL.
export function getIdentifier(url: string) {
  const postFixHash = crypto.createHash('md5')
    .update(url)
    .digest('hex')
    .substring(0, 6);
  return `pake-${postFixHash}`;
}

export async function promptText(message: string, initial?: string): Promise<string> {
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
    "interval": 80,
    "frames": [
      "✦",
      "✶",
      "✺",
      "✵",
      "✸",
      "✴︎",
      "✹",
      "✺",
    ]
  }
  return ora({ text: `${chalk.blue(text)}\n`, spinner: loadingType, color: 'blue' }).start();
}
