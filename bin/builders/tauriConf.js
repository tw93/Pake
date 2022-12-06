import CommonConf from '../../src-tauri/tauri.conf.json';
import WinConf from '../../src-tauri/tauri.windows.conf.json';
import MacConf from '../../src-tauri/tauri.macos.conf.json';

let tauriConf = {
  package: CommonConf.package,
  tauri: CommonConf.tauri
}

switch (process.arch) {
  case "win32": {
    tauriConf.tauri.bundle = WinConf.bundle;
    break;
  }
  case "darwin": {
    tauriConf.tauri.bundle = MacConf.bundle;
  }
}
export default tauriConf;


