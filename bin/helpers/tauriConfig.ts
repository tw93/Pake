import path from 'path';
import fsExtra from 'fs-extra';
import { npmDirectory } from '@/utils/dir';

// Load configs from npm package directory, not from project source
const tauriSrcDir = path.join(npmDirectory, 'src-tauri');
const pakeConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'pake.json'));
const CommonConf = fsExtra.readJSONSync(
  path.join(tauriSrcDir, 'tauri.conf.json'),
);
const WinConf = fsExtra.readJSONSync(
  path.join(tauriSrcDir, 'tauri.windows.conf.json'),
);
const MacConf = fsExtra.readJSONSync(
  path.join(tauriSrcDir, 'tauri.macos.conf.json'),
);
const LinuxConf = fsExtra.readJSONSync(
  path.join(tauriSrcDir, 'tauri.linux.conf.json'),
);

const platformConfigs = {
  win32: WinConf,
  darwin: MacConf,
  linux: LinuxConf,
};

const { platform } = process;
// @ts-ignore
const platformConfig = platformConfigs[platform];

let tauriConfig = {
  ...CommonConf,
  bundle: platformConfig.bundle,
  app: {
    ...CommonConf.app,
    trayIcon: {
      ...(platformConfig?.app?.trayIcon ?? {}),
    },
  },
  build: CommonConf.build,
  pake: pakeConf,
};

export default tauriConfig;
