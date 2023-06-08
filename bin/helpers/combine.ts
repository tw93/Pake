import path from 'path';
import fs from 'fs';
import { npmDirectory } from '@/utils/dir.js';

export default async function combineFiles(files: string[]) {
  const output = path.join(npmDirectory, `src-tauri/src/inject/_INJECT_.js`);

  const contents = files.map(file => {
    const fileContent = fs.readFileSync(file);
    if (file.endsWith('.css')) {
      return "window.addEventListener('DOMContentLoaded', (_event) => { const css = `" + fileContent + "`; const style = document.createElement('style'); style.innerHTML = css; document.head.appendChild(style); });";
    }
    return fileContent;
  });
  fs.writeFileSync(output, contents.join('\n'));
  return files;
}