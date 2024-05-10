import path from 'path';
import { fileURLToPath } from 'url';

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);

// Resolve the parent directory of the current module
export const npmDirectory = path.join(path.dirname(currentModulePath), '..');

export const tauriConfigDirectory =
  process.env.NODE_ENV === 'development'
    ? path.join(npmDirectory, 'src-tauri', '.pake')
    : path.join(npmDirectory, 'src-tauri');
