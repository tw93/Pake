import crypto from 'crypto';
import prompts from "prompts";

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
