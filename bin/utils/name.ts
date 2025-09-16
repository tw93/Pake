export function generateSafeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 255);
}

export function generateLinuxPackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function generateIdentifierSafeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function generateWindowsFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '${name}_')
    .slice(0, 255);
}

export function generateMacOSFilename(name: string): string {
  return name
    .replace(/[:]/g, '_')
    .slice(0, 255);
}