import { PakeAppOptions } from '@/types.js';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs/promises';
import { npmDirectory } from '@/utils/dir.js';

export async function promptText(message: string, initial?: string) {
  const response = await prompts({
    type: 'text',
    name: 'content',
    message,
    initial,
  });
  return response.content;
}

export async function mergeTauriConfig(
  url: string,
  options: PakeAppOptions,
  tauriConf: any
) {
  const {
    width,
    height,
    fullscreen,
    transparent,
    resizable,
    identifier,
    name,
  } = options;

  const tauriConfWindowOptions = {
    width,
    height,
    fullscreen,
    transparent,
    resizable,
  };

  Object.assign(tauriConf.tauri.windows[0], { url, ...tauriConfWindowOptions });
  tauriConf.package.productName = name;
  tauriConf.tauri.bundle.identifier = identifier;
  tauriConf.tauri.bundle.icon = [options.icon];
  if (process.platform === "win32") {
    const ico_path = path.join(npmDirectory, 'src-tauri/png/weread_32.ico');
    await fs.copyFile(options.icon, ico_path);

  }
  let configPath = "";
  switch (process.platform) {
    case "win32": {
      configPath = path.join(npmDirectory, 'src-tauri/tauri.windows.conf.json');
      break;
    }
    case "darwin": {
      configPath = path.join(npmDirectory, 'src-tauri/tauri.macos.conf.json');
      break;
    }
  }
  
  let bundleConf = {tauri: {bundle: tauriConf.tauri.bundle}};
  await fs.writeFile(
    configPath,
    Buffer.from(JSON.stringify(bundleConf), 'utf-8')
  );


  const configJsonPath = path.join(npmDirectory, 'src-tauri/tauri.conf.json')
  await fs.writeFile(
    configJsonPath,
    Buffer.from(JSON.stringify(tauriConf), 'utf-8')
  );
}
