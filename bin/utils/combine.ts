import fs from 'fs/promises';

export default async function combineFiles(files: string[], output: string) {
  const contents = await Promise.all(
    files.map(async (file) => {
      if (file.endsWith('.css')) {
        const fileContent = await fs.readFile(file, 'utf-8');
        return `window.addEventListener('DOMContentLoaded', (_event) => {
        const css = ${JSON.stringify(fileContent)};
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      });`;
      }

      const fileContent = await fs.readFile(file);
      return (
        "window.addEventListener('DOMContentLoaded', (_event) => { " +
        fileContent +
        ' });'
      );
    }),
  );
  await fs.writeFile(output, contents.join('\n'));
  return files;
}
