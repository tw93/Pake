import path from 'path';
import { fileURLToPath } from 'url';


export const npmDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
