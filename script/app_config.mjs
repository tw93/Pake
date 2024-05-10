import pakeJson from '../src-tauri/pake.json' assert { type: 'json' };
import tauriJson from '../src-tauri/tauri.conf.json' assert { type: 'json' };
import windowsJson from '../src-tauri/tauri.windows.conf.json' assert { type: 'json' };
import macosJson from '../src-tauri/tauri.macos.conf.json' assert { type: 'json' };
import linuxJson from '../src-tauri/tauri.linux.conf.json' assert { type: 'json' };

import { writeFileSync, existsSync, copyFileSync } from 'fs';
import os from 'os';

const desktopEntry = `[Desktop Entry]
Encoding=UTF-8
Categories=Office
Exec=com-pake-${process.env.NAME}
Icon=com-pake-${process.env.NAME}
Name=com-pake-${process.env.NAME}
Name[zh_CN]=${process.env.NAME_ZH}
StartupNotify=true
Terminal=false
Type=Application
`;

const variables = {
  url: process.env.URL,
  name: process.env.NAME,
  title: process.env.TITLE,
  nameZh: process.env.NAME_ZH,

  pakeConfigPath: 'src-tauri/pake.json',
  tauriConfigPath: 'src-tauri/tauri.conf.json',
  identifier: `com.pake.${process.env.NAME}`,

  linux: {
    configFilePath: 'src-tauri/tauri.linux.conf.json',
    iconPath: `src-tauri/png/${process.env.NAME}_512.png`,
    productName: `com-pake-${process.env.NAME}`,
    defaultIconPath: 'src-tauri/png/icon_512.png',
    icon: [`png/${process.env.NAME}_512.png`],
    desktopEntry,
    desktopEntryPath: `src-tauri/assets/com-pake-${process.env.NAME}.desktop`,
    desktopEntryConfig: {
      configKey: `/usr/share/applications/com-pake-${process.env.NAME}.desktop`,
      configValue: `assets/com-pake-${process.env.NAME}.desktop`,
    },
  },
  macos: {
    configFilePath: 'src-tauri/tauri.macos.conf.json',
    iconPath: `src-tauri/icons/${process.env.NAME}.icns`,
    defaultPath: 'src-tauri/icons/icon.icns',
    icon: [`icons/${process.env.NAME}.icns`],
  },
  windows: {
    configFilePath: 'src-tauri/tauri.windows.conf.json',
    iconPath: `src-tauri/png/${process.env.NAME}_32.ico`,
    defaultPath: 'src-tauri/png/icon_32.ico',
    hdIconPath: `src-tauri/png/${process.env.NAME}_256.ico`,
    hdDefaultPath: 'src-tauri/png/icon_256.ico',
    icon: [`png/${process.env.NAME}_256.ico`, `png/${process.env.NAME}_32.ico`],
    resources: [`png/${process.env.NAME}_32.ico`],
  },
};

validate();

updatePakeJson();

updateTauriJson();

let platformVariables;
let platformConfig;

switch (os.platform()) {
  case 'linux':
    platformVariables = variables.linux;
    platformConfig = linuxJson;
    updateDesktopEntry();
    break;
  case 'darwin':
    platformVariables = variables.macos;
    platformConfig = macosJson;
    break;
  case 'win32':
    platformConfig = windowsJson;
    platformVariables = variables.windows;
    updateResources();
    updateIconFile(platformVariables.hdIconPath, platformVariables.hdDefaultPath);
    break;
}

updateIconFile(platformVariables.iconPath, platformVariables.defaultIconPath);

updatePlatformConfig(platformConfig, platformVariables);

save();

function validate() {
  if (!('URL' in process.env)) {
    console.log('URL is not set');
    process.exit(1);
  }

  console.log(`URL: ${process.env.URL}`);

  if (!('NAME' in process.env)) {
    console.log('NAME is not set');
    process.exit(1);
  }

  console.log(`NAME: ${process.env.NAME}`);

  if (!('TITLE' in process.env)) {
    console.log('TITLE is not set');
    process.exit(1);
  }

  console.log(`TITLE: ${process.env.TITLE}`);

  if (!('NAME_ZH' in process.env)) {
    console.log('NAME_ZH is not set');
    process.exit(1);
  }

  console.log(`NAME_ZH: ${process.env.NAME_ZH}`);
}

function updatePakeJson() {
  pakeJson.windows[0].url = variables.url;
}

function updateTauriJson() {
  const url = new URL(variables.url);
  tauriJson.tauri.security.dangerousRemoteDomainIpcAccess[0].domain = url.hostname;
  tauriJson.package.productName = variables.title;

  writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(tauriJson, null, 2));
}

function updateIconFile(iconPath, defaultIconPath) {
  if (!existsSync(iconPath)) {
    console.warn(`Icon for ${process.env.NAME} not found, will use default icon`);
    copyFileSync(defaultIconPath, iconPath);
  }
}

function updatePlatformConfig(platformConfig, platformVariables) {
  platformConfig.tauri.bundle['icon'] = platformVariables.icon;
  platformConfig.tauri.bundle['identifier'] = variables.identifier;
}

function save() {
  writeFileSync(variables.pakeConfigPath, JSON.stringify(pakeJson, null, 2));
  writeFileSync(variables.tauriConfigPath, JSON.stringify(tauriJson, null, 2));

  writeFileSync(variables.linux.configFilePath, JSON.stringify(linuxJson, null, 2));
  writeFileSync(platformVariables.configFilePath, JSON.stringify(platformConfig, null, 2));

  writeFileSync(variables.macos.configFilePath, JSON.stringify(macosJson, null, 2));

  writeFileSync(variables.windows.configFilePath, JSON.stringify(windowsJson, null, 2));
}

function updateDesktopEntry() {
  linuxJson.tauri.bundle.deb.files = {};
  linuxJson.tauri.bundle.deb.files[variables.linux.desktopEntryConfig.configKey] = variables.linux.desktopEntryConfig.configValue;
  writeFileSync(variables.linux.desktopEntryPath, variables.linux.desktopEntry);
}

function updateResources() {
  windowsJson.tauri.bundle.resources = variables.windows.resources;
}
