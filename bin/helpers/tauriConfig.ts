import pakeConf from '../../src-tauri/pake.json';
import CommonConf from '../../src-tauri/tauri.conf.json';
import WinConf from '../../src-tauri/tauri.windows.conf.json';
import MacConf from '../../src-tauri/tauri.macos.conf.json';
import LinuxConf from '../../src-tauri/tauri.linux.conf.json';

const platformConfigs = {
  win32: WinConf,
  darwin: MacConf,
  linux: LinuxConf
};

const {platform} = process;
// @ts-ignore
const platformConfig = platformConfigs[platform];

let tauriConfig = {
  tauri: {
    ...CommonConf.tauri,
    bundle: platformConfig.tauri.bundle,
  },
  package: CommonConf.package,
  build: CommonConf.build,
  pake: pakeConf
};

export default tauriConfig;
