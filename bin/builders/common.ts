import prompts from 'prompts';

export async function promptText(message: string, initial?: string) {
  const response = await prompts({
    type: 'text',
    name: 'content',
    message,
    initial,
  });
  return response.content;
}
