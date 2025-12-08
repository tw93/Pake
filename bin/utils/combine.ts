import fs from 'fs';

export default async function combineFiles(files: string[], output: string) {
  const contents = files.map((file) => {
    if (file.endsWith('.css')) {
      const fileContent = fs.readFileSync(file, 'utf-8');
      return `window.addEventListener('DOMContentLoaded', (_event) => {
        const css = ${JSON.stringify(fileContent)};
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
      });`;
    }

    const fileContent = fs.readFileSync(file);
    return (
      "window.addEventListener('DOMContentLoaded', (_event) => { " +
      fileContent +
      ' });'
    );
  });
  fs.writeFileSync(output, contents.join('\n'));
  return files;
}
