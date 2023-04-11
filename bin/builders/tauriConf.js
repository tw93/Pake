import CommonConf from '../../src-tauri/tauri.conf.json';
import pakeConf from '../../src-tauri/pake.json';
import WinConf from '../../src-tauri/tauri.windows.conf.json';
import MacConf from '../../src-tauri/tauri.macos.conf.json';
import LinuxConf from '../../src-tauri/tauri.linux.conf.json';

let tauriConf = {
  package: CommonConf.package,
  tauri: CommonConf.tauri,
  build: CommonConf.build,
  pake: pakeConf
}
switch (process.platform) {
  case "win32": {
    tauriConf.tauri.bundle = WinConf.tauri.bundle;
    break;
  }
  case "darwin": {
    tauriConf.tauri.bundle = MacConf.tauri.bundle;
    break;
  }
  case "linux": {
    tauriConf.tauri.bundle = LinuxConf.tauri.bundle;
    break;
  }
}

export default tauriConf;


