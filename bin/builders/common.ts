import { PakeAppOptions } from '@/types.js';
import prompts, { override } from 'prompts';
import path from 'path';
import fs from 'fs/promises';
import fs2 from 'fs-extra';
import { npmDirectory } from '@/utils/dir.js';
import logger from '@/options/logger.js';


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
    userAgent,
    showMenu,
    showSystemTray,
    systemTrayIcon,
    iterCopyFile,
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
  // Package name is valid ?
  // for Linux, package name must be a-z, 0-9 or "-", not allow to A-Z and other
  if (process.platform === "linux") {
    const reg = new RegExp(/[0-9]*[a-z]+[0-9]*\-?[0-9]*[a-z]*[0-9]*\-?[0-9]*[a-z]*[0-9]*/);
    if (!reg.test(name) || reg.exec(name)[0].length != name.length) {
      logger.error("package name is illegal， it must be lowercase letters, numbers, dashes, and it must contain the lowercase letters.")
      logger.error("E.g com-123-xxx, 123pan, pan123,weread, we-read");
      process.exit();
    }
  }
  if (process.platform === "win32" || process.platform === "darwin" ) {
    const reg = new RegExp(/([0-9]*[a-zA-Z]+[0-9]*)+/);
    if (!reg.test(name) || reg.exec(name)[0].length != name.length) {
      logger.error("package name is illegal， it must be letters, numbers, and it must contain the letters")
      logger.error("E.g 123pan,123Pan Pan123,weread, WeRead, WERead");
      process.exit();
    }
  }

  // logger.warn(JSON.stringify(tauriConf.pake.windows, null, 4));
  Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });
  tauriConf.package.productName = name;
  tauriConf.tauri.bundle.identifier = identifier;
  // 判断一下url类型，是文件还是网站
  // 如果是文件，并且开启了递归拷贝功能，则需要将该文件以及所在文件夹下的所有文件拷贝到src目录下，否则只拷贝单个文件。

  const url_exists = await fs.stat(url)
    .then(() => true)
    .catch(() => false);
  if (url_exists) {
    logger.warn("you input may a local file");
    tauriConf.pake.windows[0].url_type = "local";
    const file_name = path.basename(url);
    const dir_name = path.dirname(url);
    if (!iterCopyFile) {
      const url_path = path.join(npmDirectory,"dist/", file_name);
      await fs.copyFile(url, url_path);
    } else {
      const old_dir = path.join(npmDirectory,"dist/");
      const new_dir = path.join(npmDirectory,"dist_bak/");
      fs2.moveSync(old_dir, new_dir, {"overwrite": true});
      fs2.copySync(dir_name, old_dir, {"overwrite": true});
      // logger.warn("dir name", dir_name);
      // 将dist_bak里面的cli.js和about_pake.html拷贝回去
      const cli_path = path.join(new_dir, "cli.js")
      const cli_path_target = path.join(old_dir, "cli.js")
      const about_pake_path = path.join(new_dir, "about_pake.html");
      const about_patk_path_target = path.join(old_dir, "about_pake.html")
      fs.copyFile(cli_path, cli_path_target);
      fs.copyFile(about_pake_path, about_patk_path_target);
    }
    tauriConf.pake.windows[0].url = file_name;
    tauriConf.pake.windows[0].url_type = "local";
  } else {
    tauriConf.pake.windows[0].url_type = "web";
  }

  // 处理user-agent
  if (userAgent.length > 0) {
     if (process.platform === "win32") {
      tauriConf.pake.user_agent.windows = userAgent;
     }

     if (process.platform === "linux") {
      tauriConf.pake.user_agent.linux = userAgent;
     }

     if (process.platform === "darwin") {
      tauriConf.pake.user_agent.macos = userAgent;
     }
  }

  // 处理菜单栏
  if (showMenu) {
    if (process.platform === "win32") {
      tauriConf.pake.menu.windows = true;
     }

     if (process.platform === "linux") {
      tauriConf.pake.menu.linux = true;
     }

     if (process.platform === "darwin") {
      tauriConf.pake.menu.macos = true;
     }
  } else {
    if (process.platform === "win32") {
      tauriConf.pake.menu.windows = false;
     }

     if (process.platform === "linux") {
      tauriConf.pake.menu.linux = false;
     }

     if (process.platform === "darwin") {
      tauriConf.pake.menu.macos = false;
     }
  }

  // 处理托盘
  if (showSystemTray) {
    if (process.platform === "win32") {
      tauriConf.pake.system_tray.windows = true;
     }

     if (process.platform === "linux") {
      tauriConf.pake.system_tray.linux = true;
     }

     if (process.platform === "darwin") {
      tauriConf.pake.system_tray.macos = true;
     }
  } else {
    if (process.platform === "win32") {
      tauriConf.pake.system_tray.windows = false;
     }

     if (process.platform === "linux") {
      tauriConf.pake.system_tray.linux = false;
     }

     if (process.platform === "darwin") {
      tauriConf.pake.system_tray.macos = false;
     }
  }

  // 处理targets 暂时只对linux开放
  if (process.platform === "linux") {
    delete tauriConf.tauri.bundle.deb.files;
    if (["all", "deb", "appimage"].includes(options.targets)) {
      if (options.targets === "all") {
        tauriConf.tauri.bundle.targets = ["deb", "appimage"];
      } else {
        tauriConf.tauri.bundle.targets = [options.targets];
      }
    } else {
      logger.warn("targets must be 'all', 'deb', 'appimage', we will use default 'all'");
    }
  }

  // 处理应用图标
  const exists = await fs.stat(options.icon)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    let updateIconPath = true;
    let customIconExt = path.extname(options.icon).toLowerCase();
    if (process.platform === "win32") {
      if (customIconExt === ".ico") {
        const ico_path = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}_32.ico`);
        tauriConf.tauri.bundle.resources = [`png/${name.toLowerCase()}_32.ico`];
        await fs.copyFile(options.icon, ico_path);
      } else {
        updateIconPath = false;
        logger.warn(`icon file in Windows must be 256 * 256 pix with .ico type, but you give ${customIconExt}`);
        tauriConf.tauri.bundle.icon = ["png/icon_256.ico"];
      }
    }
    if (process.platform === "linux") {
      if (customIconExt != ".png") {
        updateIconPath = false;
        logger.warn(`icon file in Linux must be 512 * 512 pix with .png type, but you give ${customIconExt}`);
        tauriConf.tauri.bundle.icon = ["png/icon_512.png"];
      }
    }

    if (process.platform === "darwin" && customIconExt !== ".icns") {
        updateIconPath = false;
        logger.warn(`icon file in MacOS must be .icns type, but you give ${customIconExt}`);
        tauriConf.tauri.bundle.icon = ["icons/icon.icns"];
    }
    if (updateIconPath) {
      tauriConf.tauri.bundle.icon = [options.icon];
    } else {
      logger.warn(`icon file will not change with default.`);
    }
  } else {
    logger.warn("the custom icon path may not exists. we will use default icon to replace it");
    if (process.platform === "win32") {
        tauriConf.tauri.bundle.icon = ["png/icon_256.ico"];
    }
    if (process.platform === "linux") {
        tauriConf.tauri.bundle.icon = ["png/icon_512.png"];
    }
    if (process.platform === "darwin") {
        tauriConf.tauri.bundle.icon = ["icons/icon.icns"];
    }
  }

  // 处理托盘自定义图标
  let useDefaultIcon = true; // 是否使用默认托盘图标
  if (systemTrayIcon.length > 0) {
    const icon_exists = await fs.stat(systemTrayIcon)
    .then(() => true)
    .catch(() => false);
    if (icon_exists) {
      // 需要判断图标格式，默认只支持ico和png两种
      let iconExt = path.extname(systemTrayIcon).toLowerCase();
      if (iconExt == ".png" || iconExt == ".icon") {
        useDefaultIcon = false;
        const trayIcoPath = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}${iconExt}`);
        tauriConf.tauri.systemTray.iconPath = `png/${name.toLowerCase()}${iconExt}`;
        await fs.copyFile(systemTrayIcon, trayIcoPath);
      } else {
        logger.warn(`file type for system tray icon mut be .ico or .png , but you give ${iconExt}`);
        logger.warn(`system tray icon file will not change with default.`);
      }
    } else {
      logger.warn(`${systemTrayIcon} not exists!`)
      logger.warn(`system tray icon file will not change with default.`);
    }
  }

  // 处理托盘默认图标
  if (useDefaultIcon) {
    if (process.platform === "linux" || process.platform === "win32") {
      tauriConf.tauri.systemTray.iconPath = tauriConf.tauri.bundle.icon[0];
    } else {
      tauriConf.tauri.systemTray.iconPath = "png/icon_512.png";
    }
  }

  // 保存配置文件
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
    case "linux": {
      configPath = path.join(npmDirectory, 'src-tauri/tauri.linux.conf.json');
      break;
    }
  }

  let bundleConf = {tauri: {bundle: tauriConf.tauri.bundle}};
  await fs.writeFile(
    configPath,
    Buffer.from(JSON.stringify(bundleConf, null, 4), 'utf-8')
  );

  const pakeConfigPath = path.join(npmDirectory, 'src-tauri/pake.json')
  await fs.writeFile(
    pakeConfigPath,
    Buffer.from(JSON.stringify(tauriConf.pake, null, 4), 'utf-8')
  );
  // logger.info("tauri config", JSON.stringify(tauriConf.build));
  let tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
  delete tauriConf2.pake;
  delete tauriConf2.tauri.bundle;

  const configJsonPath = path.join(npmDirectory, 'src-tauri/tauri.conf.json')
  await fs.writeFile(
    configJsonPath,
    Buffer.from(JSON.stringify(tauriConf2, null, 4), 'utf-8')
  );
}
