import ora from 'ora';
import log from 'loglevel';
import { InvalidArgumentError, program } from 'commander';
import fsExtra from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import psl from 'psl';
import isUrl from 'is-url';
import crypto from 'crypto';
import prompts from 'prompts';
import shelljs from 'shelljs';
import dns from 'dns';
import http from 'http';
import { promisify } from 'util';
import updateNotifier from 'update-notifier';
import fs from 'fs';

const logger = {
    info(...msg) {
        log.info(...msg.map((m) => chalk.blue.bold(m)));
    },
    debug(...msg) {
        log.debug(...msg);
    },
    error(...msg) {
        log.error(...msg.map((m) => chalk.red.bold(m)));
    },
    warn(...msg) {
        log.info(...msg.map((m) => chalk.yellow.bold(m)));
    },
    success(...msg) {
        log.info(...msg.map((m) => chalk.green.bold(m)));
    }
};

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);
// Resolve the parent directory of the current module
const npmDirectory = path.join(path.dirname(currentModulePath), '..');

const { platform: platform$2 } = process;
const IS_MAC = platform$2 === 'darwin';
const IS_WIN = platform$2 === 'win32';
const IS_LINUX = platform$2 === 'linux';

async function handleIcon(options) {
    if (options.icon) {
        if (options.icon.startsWith('http')) {
            return downloadIcon(options.icon);
        }
        else {
            return path.resolve(options.icon);
        }
    }
    else {
        logger.info('No app icon provided, default icon used. Use --icon option to assign an icon.');
        const iconPath = IS_WIN ? 'src-tauri/png/icon_256.ico' : IS_LINUX ? 'src-tauri/png/icon_512.png' : 'src-tauri/icons/icon.icns';
        return path.join(npmDirectory, iconPath);
    }
}
async function downloadIcon(iconUrl) {
    try {
        const iconResponse = await axios.get(iconUrl, { responseType: 'arraybuffer' });
        const iconData = await iconResponse.data;
        if (!iconData) {
            return null;
        }
        const fileDetails = await fileTypeFromBuffer(iconData);
        if (!fileDetails) {
            return null;
        }
        const { path: tempPath } = await dir();
        const iconPath = `${tempPath}/icon.${fileDetails.ext}`;
        await fsExtra.outputFile(iconPath, iconData);
        return iconPath;
    }
    catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
}

// Extracts the domain from a given URL.
function getDomain(inputUrl) {
    try {
        const url = new URL(inputUrl);
        // Use PSL to parse domain names.
        const parsed = psl.parse(url.hostname);
        // If domain is available, split it and return the SLD.
        if ("domain" in parsed && parsed.domain) {
            return parsed.domain.split('.')[0];
        }
        else {
            return null;
        }
    }
    catch (error) {
        return null;
    }
}
// Appends 'https://' protocol to the URL if not present.
function appendProtocol(inputUrl) {
    try {
        new URL(inputUrl);
        return inputUrl;
    }
    catch {
        return `https://${inputUrl}`;
    }
}
// Normalizes the URL by ensuring it has a protocol and is valid.
function normalizeUrl(urlToNormalize) {
    const urlWithProtocol = appendProtocol(urlToNormalize);
    if (isUrl(urlWithProtocol)) {
        return urlWithProtocol;
    }
    else {
        throw new Error(`Your url "${urlWithProtocol}" is invalid`);
    }
}

// Generates an identifier based on the given URL.
function getIdentifier(url) {
    const postFixHash = crypto.createHash('md5')
        .update(url)
        .digest('hex')
        .substring(0, 6);
    return `pake-${postFixHash}`;
}
async function promptText(message, initial) {
    const response = await prompts({
        type: 'text',
        name: 'content',
        message,
        initial,
    });
    return response.content;
}

async function handleOptions(options, url) {
    const appOptions = {
        ...options,
        identifier: getIdentifier(url),
    };
    let urlExists = await fsExtra.pathExists(url);
    if (!appOptions.name) {
        const defaultName = urlExists ? "" : getDomain(url);
        const promptMessage = 'Enter your application name';
        appOptions.name = await promptText(promptMessage, defaultName);
    }
    appOptions.icon = await handleIcon(appOptions);
    return appOptions;
}

var windows = [
	{
		url: "https://weread.qq.com/",
		transparent: true,
		fullscreen: false,
		width: 1200,
		height: 780,
		resizable: true,
		url_type: "web"
	}
];
var user_agent = {
	macos: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
	linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
	windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
};
var menu = {
	macos: true,
	linux: false,
	windows: false
};
var system_tray = {
	macos: false,
	linux: true,
	windows: true
};
var pakeConf = {
	windows: windows,
	user_agent: user_agent,
	menu: menu,
	system_tray: system_tray
};

var tauri$3 = {
	security: {
		csp: null,
		dangerousRemoteDomainIpcAccess: [
			{
				domain: "weread.qq.com",
				windows: [
					"pake"
				],
				enableTauriAPI: true
			}
		]
	},
	updater: {
		active: false
	},
	systemTray: {
		iconPath: "png/weread_512.png",
		iconAsTemplate: true
	},
	allowlist: {
		all: true,
		fs: {
			all: true,
			scope: [
				"$DOWNLOAD/*"
			]
		}
	}
};
var build = {
	withGlobalTauri: true,
	devPath: "../dist",
	distDir: "../dist",
	beforeBuildCommand: "",
	beforeDevCommand: ""
};
var CommonConf = {
	"package": {
	productName: "WeRead",
	version: "1.0.0"
},
	tauri: tauri$3,
	build: build
};

var tauri$2 = {
	bundle: {
		icon: [
			"png/weread_256.ico",
			"png/weread_32.ico"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		externalBin: [
		],
		longDescription: "",
		resources: [
			"png/weread_32.ico"
		],
		shortDescription: "",
		targets: [
			"msi"
		],
		windows: {
			certificateThumbprint: null,
			digestAlgorithm: "sha256",
			timestampUrl: "",
			wix: {
				language: [
					"en-US"
				],
				template: "assets/main.wxs"
			}
		}
	}
};
var WinConf = {
	tauri: tauri$2
};

var tauri$1 = {
	bundle: {
		icon: [
			"icons/weread.icns"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		externalBin: [
		],
		longDescription: "",
		macOS: {
			entitlements: null,
			exceptionDomain: "",
			frameworks: [
			],
			providerShortName: null,
			signingIdentity: null
		},
		resources: [
		],
		shortDescription: "",
		targets: [
			"dmg"
		]
	}
};
var MacConf = {
	tauri: tauri$1
};

var tauri = {
	bundle: {
		icon: [
			"png/weread_512.png"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		deb: {
			depends: [
				"curl",
				"wget"
			],
			files: {
				"/usr/share/applications/com-tw93-weread.desktop": "assets/com-tw93-weread.desktop"
			}
		},
		externalBin: [
		],
		longDescription: "",
		resources: [
		],
		shortDescription: "",
		targets: [
			"deb",
			"appimage"
		]
	}
};
var LinuxConf = {
	tauri: tauri
};

const platformConfigs = {
    win32: WinConf,
    darwin: MacConf,
    linux: LinuxConf
};
const { platform: platform$1 } = process;
// @ts-ignore
const platformConfig = platformConfigs[platform$1];
let tauriConfig = {
    tauri: {
        ...CommonConf.tauri,
        bundle: platformConfig.tauri.bundle,
    },
    package: CommonConf.package,
    build: CommonConf.build,
    pake: pakeConf
};

function shellExec(command) {
    return new Promise((resolve, reject) => {
        shelljs.exec(command, { async: true, silent: false, cwd: npmDirectory }, (code) => {
            if (code === 0) {
                resolve(0);
            }
            else {
                reject(new Error(`${code}`));
            }
        });
    });
}

const resolve = promisify(dns.resolve);
const ping = async (host) => {
    const lookup = promisify(dns.lookup);
    const ip = await lookup(host);
    const start = new Date();
    // Prevent timeouts from affecting user experience.
    const requestPromise = new Promise((resolve, reject) => {
        const req = http.get(`http://${ip.address}`, (res) => {
            const delay = new Date().getTime() - start.getTime();
            res.resume();
            resolve(delay);
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out after 3 seconds'));
        }, 3000);
    });
    return Promise.race([requestPromise, timeoutPromise]);
};
async function isChinaDomain(domain) {
    try {
        const [ip] = await resolve(domain);
        return await isChinaIP(ip, domain);
    }
    catch (error) {
        logger.debug(`${domain} can't be parse!`);
        return false;
    }
}
async function isChinaIP(ip, domain) {
    try {
        const delay = await ping(ip);
        logger.debug(`${domain} latency is ${delay} ms`);
        return delay > 500;
    }
    catch (error) {
        logger.debug(`ping ${domain} failed!`);
        return false;
    }
}

async function installRust() {
    const isInChina = await isChinaDomain("sh.rustup.rs");
    const rustInstallScriptForMac = isInChina
        ? 'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh'
        : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
    const rustInstallScriptForWindows = 'winget install --id Rustlang.Rustup';
    const spinner = ora('Downloading Rust').start();
    try {
        await shellExec(IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac);
        spinner.succeed();
    }
    catch (error) {
        console.error('Error installing Rust:', error.message);
        spinner.fail();
        //@ts-ignore
        process.exit(1);
    }
}
function checkRustInstalled() {
    return shelljs.exec('rustc --version', { silent: true }).code === 0;
}

class BaseBuilder {
    async prepare() {
        // Windows and Linux need to install necessary build tools.
        if (!IS_MAC) {
            logger.info('Install Rust and required build tools to build the app.');
            logger.info('See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing.');
        }
        if (checkRustInstalled()) {
            return;
        }
        const res = await prompts({
            type: 'confirm',
            message: 'Rust not detected. Install now?',
            name: 'value',
        });
        if (res.value) {
            await installRust();
        }
        else {
            logger.error('Error: Rust required to package your webapp!');
            process.exit(2);
        }
    }
    async runBuildCommand(directory, command) {
        const spinner = ora('Building...').start();
        setTimeout(() => spinner.succeed(), 5000);
        const isChina = await isChinaDomain("www.npmjs.com");
        if (isChina) {
            logger.info("Located in China, using npm/Rust CN mirror.");
            const rustProjectDir = path.join(directory, 'src-tauri', ".cargo");
            await fsExtra.ensureDir(rustProjectDir);
            const projectCnConf = path.join(directory, "src-tauri", "rust_proxy.toml");
            const projectConf = path.join(rustProjectDir, "config");
            await fsExtra.copy(projectCnConf, projectConf);
            await shellExec(`cd "${directory}" && npm install --registry=https://registry.npmmirror.com && ${command}`);
        }
        else {
            await shellExec(`cd "${directory}" && npm install && ${command}`);
        }
    }
}

async function mergeConfig(url, options, tauriConf) {
    const { width, height, fullscreen, transparent, resizable, userAgent, showMenu, showSystemTray, systemTrayIcon, iterCopyFile, identifier, name, } = options;
    const { platform } = process;
    // Set Windows parameters.
    const tauriConfWindowOptions = {
        width,
        height,
        fullscreen,
        transparent,
        resizable,
    };
    Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });
    // Determine whether the package name is valid.
    // for Linux, package name must be a-z, 0-9 or "-", not allow to A-Z and other
    const platformRegexMapping = {
        linux: /[0-9]*[a-z]+[0-9]*\-?[0-9]*[a-z]*[0-9]*\-?[0-9]*[a-z]*[0-9]*/,
        default: /([0-9]*[a-zA-Z]+[0-9]*)+/,
    };
    const reg = platformRegexMapping[platform] || platformRegexMapping.default;
    const nameCheck = reg.test(name) && reg.exec(name)[0].length === name.length;
    if (!nameCheck) {
        const errorMsg = platform === 'linux'
            ? `Package name is invalid. It should only include lowercase letters, numbers, and dashes, and must contain at least one lowercase letter. Examples: com-123-xxx, 123pan, pan123, weread, we-read.`
            : `Package name is invalid. It should only include letters and numbers, and must contain at least one letter. Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead.`;
        logger.error(errorMsg);
        process.exit();
    }
    tauriConf.package.productName = name;
    tauriConf.tauri.bundle.identifier = identifier;
    // Judge the type of URL, whether it is a file or a website.
    // If it is a file and the recursive copy function is enabled then the file and all files in its parent folder need to be copied to the "src" directory. Otherwise, only the single file will be copied.
    const urlExists = await fsExtra.pathExists(url);
    if (urlExists) {
        logger.warn('Your input might be a local file.');
        tauriConf.pake.windows[0].url_type = 'local';
        const fileName = path.basename(url);
        const dirName = path.dirname(url);
        const distDir = path.join(npmDirectory, 'dist');
        const distBakDir = path.join(npmDirectory, 'dist_bak');
        if (!iterCopyFile) {
            const urlPath = path.join(distDir, fileName);
            await fsExtra.copy(url, urlPath);
        }
        else {
            fsExtra.moveSync(distDir, distBakDir, { overwrite: true });
            fsExtra.copySync(dirName, distDir, { overwrite: true });
            const filesToCopyBack = ['cli.js', 'about_pake.html'];
            await Promise.all(filesToCopyBack.map((file) => fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file))));
        }
        tauriConf.pake.windows[0].url = fileName;
        tauriConf.pake.windows[0].url_type = 'local';
    }
    else {
        tauriConf.pake.windows[0].url_type = 'web';
        // Set the secure domain for calling window.__TAURI__ to the application domain that has been set.
        tauriConf.tauri.security.dangerousRemoteDomainIpcAccess[0].domain =
            new URL(url).hostname;
    }
    const platformMap = {
        win32: 'windows',
        linux: 'linux',
        darwin: 'macos',
    };
    const currentPlatform = platformMap[platform];
    if (userAgent.length > 0) {
        tauriConf.pake.user_agent[currentPlatform] = userAgent;
    }
    tauriConf.pake.menu[currentPlatform] = showMenu;
    tauriConf.pake.system_tray[currentPlatform] = showSystemTray;
    // Processing targets are currently only open to Linux.
    if (platform === 'linux') {
        delete tauriConf.tauri.bundle.deb.files;
        const validTargets = ['all', 'deb', 'appimage'];
        if (validTargets.includes(options.targets)) {
            tauriConf.tauri.bundle.targets = options.targets === 'all' ? ['deb', 'appimage'] : [options.targets];
        }
        else {
            logger.warn(`The target must be one of ${validTargets.join(', ')}, the default 'deb' will be used.`);
        }
    }
    // Set icon.
    const platformIconMap = {
        win32: {
            fileExt: '.ico',
            path: `png/${name.toLowerCase()}_256.ico`,
            defaultIcon: 'png/icon_256.ico',
            message: 'Windows icon must be .ico and 256x256px.',
        },
        linux: {
            fileExt: '.png',
            path: `png/${name.toLowerCase()}_512.png`,
            defaultIcon: 'png/icon_512.png',
            message: 'Linux icon must be .png and 512x512px.',
        },
        darwin: {
            fileExt: '.icns',
            path: `icons/${name.toLowerCase()}.icns`,
            defaultIcon: 'icons/icon.icns',
            message: 'MacOS icon must be .icns type.',
        },
    };
    const iconInfo = platformIconMap[platform];
    const exists = await fsExtra.pathExists(options.icon);
    if (exists) {
        let updateIconPath = true;
        let customIconExt = path.extname(options.icon).toLowerCase();
        if (customIconExt !== iconInfo.fileExt) {
            updateIconPath = false;
            logger.warn(`${iconInfo.message}, but you give ${customIconExt}`);
            tauriConf.tauri.bundle.icon = [iconInfo.defaultIcon];
        }
        else {
            const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
            tauriConf.tauri.bundle.resources = [iconInfo.path];
            await fsExtra.copy(options.icon, iconPath);
        }
        if (updateIconPath) {
            tauriConf.tauri.bundle.icon = [options.icon];
        }
        else {
            logger.warn(`Icon will remain as default.`);
        }
    }
    else {
        logger.warn('Custom icon path may be invalid. Default icon will be used instead.');
        tauriConf.tauri.bundle.icon = [iconInfo.defaultIcon];
    }
    // Set tray icon path.
    let trayIconPath = platform === 'darwin' ? 'png/icon_512.png' : tauriConf.tauri.bundle.icon[0];
    if (systemTrayIcon.length > 0) {
        try {
            await fsExtra.pathExists(systemTrayIcon);
            // 需要判断图标格式，默认只支持ico和png两种
            let iconExt = path.extname(systemTrayIcon).toLowerCase();
            if (iconExt == '.png' || iconExt == '.ico') {
                const trayIcoPath = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}${iconExt}`);
                trayIconPath = `png/${name.toLowerCase()}${iconExt}`;
                await fsExtra.copy(systemTrayIcon, trayIcoPath);
            }
            else {
                logger.warn(`System tray icon must be .ico or .png, but you provided ${iconExt}.`);
                logger.warn(`Default system tray icon will be used.`);
            }
        }
        catch {
            logger.warn(`${systemTrayIcon} not exists!`);
            logger.warn(`Default system tray icon will remain unchanged.`);
        }
    }
    tauriConf.tauri.systemTray.iconPath = trayIconPath;
    // Save config file.
    const platformConfigPaths = {
        win32: 'src-tauri/tauri.windows.conf.json',
        darwin: 'src-tauri/tauri.macos.conf.json',
        linux: 'src-tauri/tauri.linux.conf.json',
    };
    const configPath = path.join(npmDirectory, platformConfigPaths[platform]);
    const bundleConf = { tauri: { bundle: tauriConf.tauri.bundle } };
    await fsExtra.writeJson(configPath, bundleConf, { spaces: 4 });
    const pakeConfigPath = path.join(npmDirectory, 'src-tauri/pake.json');
    await fsExtra.writeJson(pakeConfigPath, tauriConf.pake, { spaces: 4 });
    let tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
    delete tauriConf2.pake;
    delete tauriConf2.tauri.bundle;
    const configJsonPath = path.join(npmDirectory, 'src-tauri/tauri.conf.json');
    await fsExtra.writeJson(configJsonPath, tauriConf2, { spaces: 4 });
}

class MacBuilder extends BaseBuilder {
    async build(url, options) {
        const { name } = options;
        await mergeConfig(url, options, tauriConfig);
        let dmgName;
        if (options.multiArch) {
            await this.runBuildCommand(npmDirectory, 'npm run build:mac');
            dmgName = `${name}_${tauriConfig.package.version}_universal.dmg`;
        }
        else {
            await this.runBuildCommand(npmDirectory, 'npm run build');
            let arch = process.arch === "arm64" ? "aarch64" : process.arch;
            dmgName = `${name}_${tauriConfig.package.version}_${arch}.dmg`;
        }
        const appPath = this.getBuildAppPath(npmDirectory, dmgName, options.multiArch);
        const distPath = path.resolve(`${name}.dmg`);
        await fsExtra.copy(appPath, distPath);
        await fsExtra.remove(appPath);
        logger.success('Build success!');
        logger.success('App installer located in', distPath);
    }
    getBuildAppPath(npmDirectory, dmgName, multiArch) {
        const dmgPath = multiArch ? 'src-tauri/target/universal-apple-darwin/release/bundle/dmg' : 'src-tauri/target/release/bundle/dmg';
        return path.join(npmDirectory, dmgPath, dmgName);
    }
}

class WinBuilder extends BaseBuilder {
    async build(url, options) {
        const { name } = options;
        await mergeConfig(url, options, tauriConfig);
        await this.runBuildCommand(npmDirectory, 'npm run build');
        const language = tauriConfig.tauri.bundle.windows.wix.language[0];
        const arch = process.arch;
        const msiName = `${name}_${tauriConfig.package.version}_${arch}_${language}.msi`;
        const appPath = this.getBuildAppPath(npmDirectory, msiName);
        const distPath = path.resolve(`${name}.msi`);
        await fsExtra.copy(appPath, distPath);
        await fsExtra.remove(appPath);
        logger.success('Build success!');
        logger.success('App installer located in', distPath);
    }
    getBuildAppPath(npmDirectory, msiName) {
        return path.join(npmDirectory, 'src-tauri/target/release/bundle/msi', msiName);
    }
}

class LinuxBuilder extends BaseBuilder {
    async build(url, options) {
        const { name } = options;
        await mergeConfig(url, options, tauriConfig);
        await this.runBuildCommand(npmDirectory, 'npm run build');
        const arch = process.arch === "x64" ? "amd64" : process.arch;
        if (options.targets === "deb" || options.targets === "all") {
            const debName = `${name}_${tauriConfig.package.version}_${arch}.deb`;
            const appPath = this.getBuildAppPath(npmDirectory, "deb", debName);
            const distPath = path.resolve(`${name}.deb`);
            await fsExtra.copy(appPath, distPath);
            await fsExtra.remove(appPath);
            logger.success('Build Deb success!');
            logger.success('Deb app installer located in', distPath);
        }
        if (options.targets === "appimage" || options.targets === "all") {
            const appImageName = `${name}_${tauriConfig.package.version}_${arch}.AppImage`;
            const appImagePath = this.getBuildAppPath(npmDirectory, "appimage", appImageName);
            const distAppPath = path.resolve(`${name}.AppImage`);
            await fsExtra.copy(appImagePath, distAppPath);
            await fsExtra.remove(appImagePath);
            logger.success('Build AppImage success!');
            logger.success('AppImage installer located in', distAppPath);
        }
    }
    getBuildAppPath(npmDirectory, packageType, packageName) {
        return path.join(npmDirectory, 'src-tauri/target/release/bundle/', packageType, packageName);
    }
}

const { platform } = process;
const buildersMap = {
    darwin: MacBuilder,
    win32: WinBuilder,
    linux: LinuxBuilder,
};
class BuilderProvider {
    static create() {
        const Builder = buildersMap[platform];
        if (!Builder) {
            throw new Error('The current system is not supported!');
        }
        return new Builder();
    }
}

var name = "pake-cli";
var version = "2.1.1";
var description = "🤱🏻 Turn any webpage into a desktop app with Rust. 🤱🏻 很简单的用 Rust 打包网页生成很小的桌面 App。";
var engines = {
	node: ">=16.0.0"
};
var bin = {
	pake: "./cli.js"
};
var repository = {
	type: "git",
	url: "https://github.com/tw93/pake.git"
};
var author = {
	name: "Tw93",
	email: "tw93@qq.com"
};
var keywords = [
	"pake",
	"pake-cli",
	"rust",
	"tauri",
	"no-electron",
	"productivity"
];
var files = [
	"dist",
	"src-tauri",
	"cli.js"
];
var scripts = {
	start: "npm run dev",
	dev: "npm run tauri dev",
	build: "npm run tauri build --release",
	"build:mac": "npm run tauri build -- --target universal-apple-darwin",
	"build:all-unix": "chmod +x ./script/build.sh && ./script/build.sh",
	"build:all-windows": "pwsh ./script/build.ps1",
	analyze: "cd src-tauri && cargo bloat --release --crates",
	tauri: "tauri",
	cli: "rollup -c rollup.config.js --watch",
	"cli:build": "cross-env NODE_ENV=production rollup -c rollup.config.js",
	prepublishOnly: "npm run cli:build"
};
var type = "module";
var exports = "./dist/pake.js";
var license = "MIT";
var dependencies = {
	"@tauri-apps/api": "^1.4.0",
	"@tauri-apps/cli": "^1.4.0",
	axios: "^1.1.3",
	chalk: "^5.1.2",
	commander: "^11.0.0",
	"file-type": "^18.0.0",
	"fs-extra": "^11.1.0",
	"is-url": "^1.2.4",
	loglevel: "^1.8.1",
	ora: "^6.1.2",
	prompts: "^2.4.2",
	psl: "^1.9.0",
	shelljs: "^0.8.5",
	"tmp-promise": "^3.0.3",
	"update-notifier": "^6.0.2"
};
var devDependencies = {
	"@rollup/plugin-alias": "^4.0.2",
	"@rollup/plugin-commonjs": "^23.0.2",
	"@rollup/plugin-json": "^5.0.2",
	"@rollup/plugin-terser": "^0.1.0",
	"@types/fs-extra": "^9.0.13",
	"@types/is-url": "^1.2.30",
	"@types/page-icon": "^0.3.4",
	"@types/prompts": "^2.4.1",
	"@types/psl": "^1.1.0",
	"@types/shelljs": "^0.8.11",
	"@types/tmp": "^0.2.3",
	"@types/update-notifier": "^6.0.1",
	"app-root-path": "^3.1.0",
	"cross-env": "^7.0.3",
	rollup: "^3.3.0",
	"rollup-plugin-typescript2": "^0.34.1",
	tslib: "^2.4.1",
	typescript: "^4.9.3"
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	engines: engines,
	bin: bin,
	repository: repository,
	author: author,
	keywords: keywords,
	files: files,
	scripts: scripts,
	type: type,
	exports: exports,
	license: license,
	dependencies: dependencies,
	devDependencies: devDependencies
};

async function checkUpdateTips() {
    updateNotifier({ pkg: packageJson }).notify();
}

function validateNumberInput(value) {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}
function validateUrlInput(url) {
    const isFile = fs.existsSync(url);
    if (!isFile) {
        try {
            return normalizeUrl(url);
        }
        catch (error) {
            throw new InvalidArgumentError(error.message);
        }
    }
    return url;
}

const DEFAULT_PAKE_OPTIONS = {
    icon: '',
    height: 780,
    width: 1200,
    fullscreen: false,
    resizable: true,
    transparent: false,
    userAgent: '',
    showMenu: false,
    showSystemTray: false,
    multiArch: false,
    targets: 'deb',
    iterCopyFile: false,
    systemTrayIcon: '',
    debug: false,
};

program
    .version(packageJson.version)
    .description('A CLI that can turn any webpage into a desktop app with Rust.')
    .showHelpAfterError();
program
    .argument('[url]', 'The web URL you want to package', validateUrlInput)
    .option('--name <string>', 'Application name')
    .option('--icon <string>', 'Application icon', DEFAULT_PAKE_OPTIONS.icon)
    .option('--height <number>', 'Window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
    .option('--width <number>', 'Window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
    .option('--no-resizable', 'Whether the window can be resizable', DEFAULT_PAKE_OPTIONS.resizable)
    .option('--fullscreen', 'Start the packaged app in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
    .option('--transparent', 'Transparent title bar', DEFAULT_PAKE_OPTIONS.transparent)
    .option('--user-agent <string>', 'Custom user agent', DEFAULT_PAKE_OPTIONS.userAgent)
    .option('--show-menu', 'Show menu in app', DEFAULT_PAKE_OPTIONS.showMenu)
    .option('--show-system-tray', 'Show system tray in app', DEFAULT_PAKE_OPTIONS.showSystemTray)
    .option('--system-tray-icon <string>', 'Custom system tray icon', DEFAULT_PAKE_OPTIONS.systemTrayIcon)
    .option('--iter-copy-file', 'Copy files to app when URL is a local file', DEFAULT_PAKE_OPTIONS.iterCopyFile)
    .option('--multi-arch', 'Available for Mac only, supports both Intel and M1', DEFAULT_PAKE_OPTIONS.multiArch)
    .option('--targets <string>', 'Only for Linux, option "deb", "appimage" or "all"', DEFAULT_PAKE_OPTIONS.targets)
    .option('--debug', 'Debug mode', DEFAULT_PAKE_OPTIONS.debug)
    .action(async (url, options) => {
    //Check for update prompt
    await checkUpdateTips();
    // If no URL is provided, display help information
    if (!url) {
        program.help();
    }
    log.setDefaultLevel('info');
    if (options.debug) {
        log.setLevel('debug');
    }
    const spinner = ora('Preparing...').start();
    const builder = BuilderProvider.create();
    await builder.prepare();
    const appOptions = await handleOptions(options, url);
    spinner.succeed();
    log.debug('PakeAppOptions', appOptions);
    await builder.build(url, appOptions);
});
program.parse();
