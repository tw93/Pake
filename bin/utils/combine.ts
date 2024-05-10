import fs from 'fs';

export default async function combineFiles(files: string[], output: string) {
  const contents = files.map(file => {
    const fileContent = fs.readFileSync(file);
    if (file.endsWith('.css')) {
      return (
        "window.addEventListener('DOMContentLoaded', (_event) => { const css = `" +
        fileContent +
        "`; const style = document.createElement('style'); style.innerHTML = css; document.head.appendChild(style); });"
      );
    }

    return "window.addEventListener('DOMContentLoaded', (_event) => { " + fileContent + ' });';
  });
  fs.writeFileSync(output, contents.join('\n'));
  return files;
}
