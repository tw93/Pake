import path from 'path';
import { fileURLToPath } from 'url';

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);

// Resolve the parent directory of the current module
export const npmDirectory = process.env.DEV === 'true' ? process.cwd() : path.join(path.dirname(currentModulePath), '..');
