#!/usr/bin/env node
import log from 'loglevel';
import updateNotifier from 'update-notifier';
import path from 'path';
import fsExtra from 'fs-extra';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import prompts from 'prompts';
import os from 'os';
import { execa, execaSync } from 'execa';
import crypto from 'crypto';
import ora from 'ora';
import dns from 'dns';
import http from 'http';
import { promisify } from 'util';
import fs from 'fs';
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';
import icongen from 'icon-gen';
import sharp from 'sharp';
import * as psl from 'psl';
import { InvalidArgumentError, program as program$1, Option } from 'commander';

var name = "pake-cli";
var version = "3.9.1";
var description = "🤱🏻 Turn any webpage into a desktop app with one command. 🤱🏻 一键打包网页生成轻量桌面应用。";
var engines = {
	node: ">=18.0.0"
};
var packageManager = "pnpm@10.26.2";
var bin = {
	pake: "./dist/cli.js"
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
	"src-tauri"
];
var scripts = {
	start: "pnpm run dev",
	dev: "pnpm run tauri dev",
	build: "tauri build",
	"build:debug": "tauri build --debug",
	"build:mac": "tauri build --target universal-apple-darwin",
	analyze: "cd src-tauri && cargo bloat --release --crates",
	tauri: "tauri",
	cli: "cross-env NODE_ENV=development rollup -c -w",
	"cli:build": "cross-env NODE_ENV=production rollup -c",
	test: "pnpm run cli:build && cross-env PAKE_CREATE_APP=1 node tests/index.js",
	format: "prettier --write . --ignore-unknown && find tests -name '*.js' -exec sed -i '' 's/[[:space:]]*$//' {} \\; && cd src-tauri && cargo fmt --verbose",
	"format:check": "prettier --check . --ignore-unknown",
	update: "pnpm update --verbose && cd src-tauri && cargo update",
	prepublishOnly: "pnpm run cli:build"
};
var type = "module";
var exports$1 = "./dist/cli.js";
var license = "MIT";
var dependencies = {
	"@tauri-apps/api": "~2.10.1",
	"@tauri-apps/cli": "^2.10.0",
	chalk: "^5.6.2",
	commander: "^14.0.3",
	execa: "^9.6.1",
	"file-type": "^21.3.0",
	"fs-extra": "^11.3.3",
	"icon-gen": "^5.0.0",
	loglevel: "^1.9.2",
	ora: "^9.3.0",
	prompts: "^2.4.2",
	psl: "^1.15.0",
	sharp: "^0.34.5",
	"tmp-promise": "^3.0.3",
	"update-notifier": "^7.3.1"
};
var devDependencies = {
	"@rollup/plugin-alias": "^6.0.0",
	"@rollup/plugin-commonjs": "^29.0.0",
	"@rollup/plugin-json": "^6.1.0",
	"@rollup/plugin-replace": "^6.0.3",
	"@rollup/plugin-terser": "^0.4.4",
	"@types/fs-extra": "^11.0.4",
	"@types/node": "^25.3.0",
	"@types/page-icon": "^0.3.6",
	"@types/prompts": "^2.4.9",
	"@types/tmp": "^0.2.6",
	"@types/update-notifier": "^6.0.8",
	"app-root-path": "^3.1.0",
	"cross-env": "^10.1.0",
	prettier: "^3.8.1",
	rollup: "^4.58.0",
	"rollup-plugin-typescript2": "^0.36.0",
	tslib: "^2.8.1",
	typescript: "^5.9.3",
	vitest: "^4.0.18"
};
var pnpm = {
	overrides: {
		sharp: "^0.34.5"
	},
	onlyBuiltDependencies: [
		"esbuild",
		"sharp"
	]
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	engines: engines,
	packageManager: packageManager,
	bin: bin,
	repository: repository,
	author: author,
	keywords: keywords,
	files: files,
	scripts: scripts,
	type: type,
	exports: exports$1,
	license: license,
	dependencies: dependencies,
	devDependencies: devDependencies,
	pnpm: pnpm
};

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);
// Resolve the parent directory of the current module
const npmDirectory = path.join(path.dirname(currentModulePath), '..');
const tauriConfigDirectory = path.join(npmDirectory, 'src-tauri', '.pake');

// Load configs from npm package directory, not from project source
const tauriSrcDir = path.join(npmDirectory, 'src-tauri');
const pakeConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'pake.json'));
const CommonConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.conf.json'));
const WinConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.windows.conf.json'));
const MacConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.macos.conf.json'));
const LinuxConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.linux.conf.json'));
const platformConfigs = {
    win32: WinConf,
    darwin: MacConf,
    linux: LinuxConf,
};
const { platform: platform$2 } = process;
// @ts-ignore
const platformConfig = platformConfigs[platform$2];
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

// Generates an identifier based on the given URL.
function getIdentifier(url) {
    const postFixHash = crypto
        .createHash('md5')
        .update(url)
        .digest('hex')
        .substring(0, 6);
    return `com.pake.${postFixHash}`;
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
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function getSpinner(text) {
    const loadingType = {
        interval: 80,
        frames: ['✦', '✶', '✺', '✵', '✸', '✹', '✺'],
    };
    return ora({
        text: `${chalk.cyan(text)}\n`,
        spinner: loadingType,
        color: 'cyan',
    }).start();
}

const { platform: platform$1 } = process;
const IS_MAC = platform$1 === 'darwin';
const IS_WIN = platform$1 === 'win32';
const IS_LINUX = platform$1 === 'linux';

async function shellExec(command, timeout = 300000, env) {
    try {
        const { exitCode } = await execa(command, {
            cwd: npmDirectory,
            // Use 'inherit' to show all output directly to user in real-time.
            // This ensures linuxdeploy and other tool outputs are visible during builds.
            stdio: 'inherit',
            shell: true,
            timeout,
            env: env ? { ...process.env, ...env } : process.env,
        });
        return exitCode;
    }
    catch (error) {
        const exitCode = error.exitCode ?? 'unknown';
        const errorMessage = error.message || 'Unknown error occurred';
        if (error.timedOut) {
            throw new Error(`Command timed out after ${timeout}ms: "${command}". Try increasing timeout or check network connectivity.`);
        }
        let errorMsg = `Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`;
        // Provide helpful guidance for common Linux AppImage build failures
        // caused by strip tool incompatibility with modern glibc (2.38+)
        const lowerError = errorMessage.toLowerCase();
        if (process.platform === 'linux' &&
            (lowerError.includes('linuxdeploy') ||
                lowerError.includes('appimage') ||
                lowerError.includes('strip'))) {
            errorMsg +=
                '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    'Linux AppImage Build Failed\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                    'Cause: Strip tool incompatibility with glibc 2.38+\n' +
                    '       (affects Debian Trixie, Arch Linux, and other modern distros)\n\n' +
                    'Quick fix:\n' +
                    '  NO_STRIP=1 pake <url> --targets appimage --debug\n\n' +
                    'Alternatives:\n' +
                    '  • Use DEB format: pake <url> --targets deb\n' +
                    '  • Update binutils: sudo apt install binutils (or pacman -S binutils)\n' +
                    '  • Detailed guide: https://github.com/tw93/Pake/blob/main/docs/faq.md\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
            if (lowerError.includes('fuse') ||
                lowerError.includes('operation not permitted') ||
                lowerError.includes('/dev/fuse')) {
                errorMsg +=
                    '\n\nDocker / Container hint:\n' +
                        '  AppImage tooling needs access to /dev/fuse. When running inside Docker, add:\n' +
                        '    --privileged --device /dev/fuse --security-opt apparmor=unconfined\n' +
                        '  or run on the host directly.';
            }
        }
        throw new Error(errorMsg);
    }
}

const logger = {
    info(...msg) {
        log.info(...msg.map((m) => chalk.white(m)));
    },
    debug(...msg) {
        log.debug(...msg);
    },
    error(...msg) {
        log.error(...msg.map((m) => chalk.red(m)));
    },
    warn(...msg) {
        log.info(...msg.map((m) => chalk.yellow(m)));
    },
    success(...msg) {
        log.info(...msg.map((m) => chalk.green(m)));
    },
};

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
        }, 1000);
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
        return true;
    }
}
async function isChinaIP(ip, domain) {
    try {
        const delay = await ping(ip);
        logger.debug(`${domain} latency is ${delay} ms`);
        return delay > 1000;
    }
    catch (error) {
        logger.debug(`ping ${domain} failed!`);
        return true;
    }
}

function normalizePathForComparison(targetPath) {
    const normalized = path.normalize(targetPath);
    return IS_WIN ? normalized.toLowerCase() : normalized;
}
function getCargoHomeCandidates() {
    const candidates = new Set();
    if (process.env.CARGO_HOME) {
        candidates.add(process.env.CARGO_HOME);
    }
    const homeDir = os.homedir();
    if (homeDir) {
        candidates.add(path.join(homeDir, '.cargo'));
    }
    if (IS_WIN && process.env.USERPROFILE) {
        candidates.add(path.join(process.env.USERPROFILE, '.cargo'));
    }
    return Array.from(candidates).filter(Boolean);
}
function ensureCargoBinOnPath() {
    const currentPath = process.env.PATH || '';
    const segments = currentPath.split(path.delimiter).filter(Boolean);
    const normalizedSegments = new Set(segments.map((segment) => normalizePathForComparison(segment)));
    const additions = [];
    let cargoHomeSet = Boolean(process.env.CARGO_HOME);
    for (const cargoHome of getCargoHomeCandidates()) {
        const binDir = path.join(cargoHome, 'bin');
        if (fsExtra.pathExistsSync(binDir) &&
            !normalizedSegments.has(normalizePathForComparison(binDir))) {
            additions.push(binDir);
            normalizedSegments.add(normalizePathForComparison(binDir));
        }
        if (!cargoHomeSet && fsExtra.pathExistsSync(cargoHome)) {
            process.env.CARGO_HOME = cargoHome;
            cargoHomeSet = true;
        }
    }
    if (additions.length) {
        const prefix = additions.join(path.delimiter);
        process.env.PATH = segments.length
            ? `${prefix}${path.delimiter}${segments.join(path.delimiter)}`
            : prefix;
    }
}
function ensureRustEnv() {
    ensureCargoBinOnPath();
}
async function installRust() {
    const isActions = process.env.GITHUB_ACTIONS;
    const isInChina = await isChinaDomain('sh.rustup.rs');
    const rustInstallScriptForMac = isInChina && !isActions
        ? 'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh'
        : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
    const rustInstallScriptForWindows = 'winget install --id Rustlang.Rustup';
    const spinner = getSpinner('Downloading Rust...');
    try {
        await shellExec(IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac, 300000, undefined);
        spinner.succeed(chalk.green('✔ Rust installed successfully!'));
        ensureRustEnv();
    }
    catch (error) {
        spinner.fail(chalk.red('✕ Rust installation failed!'));
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error(error);
        }
        process.exit(1);
    }
}
function checkRustInstalled() {
    ensureCargoBinOnPath();
    try {
        execaSync('rustc', ['--version']);
        return true;
    }
    catch {
        return false;
    }
}

async function combineFiles(files, output) {
    const contents = files.map((file) => {
        if (file.endsWith('.css')) {
            const fileContent = fs.readFileSync(file, 'utf-8');
            return `window.addEventListener('DOMContentLoaded', (_event) => {
        const css = ${JSON.stringify(fileContent)};
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
      });`;
        }
        const fileContent = fs.readFileSync(file);
        return ("window.addEventListener('DOMContentLoaded', (_event) => { " +
            fileContent +
            ' });');
    });
    fs.writeFileSync(output, contents.join('\n'));
    return files;
}

function generateSafeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+$/g, '')
        .slice(0, 255);
}
function getSafeAppName(name) {
    return generateSafeFilename(name).toLowerCase();
}
function generateLinuxPackageName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}
function generateIdentifierSafeName(name) {
    const cleaned = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').toLowerCase();
    if (cleaned === '') {
        const fallback = Array.from(name)
            .map((char) => {
            const code = char.charCodeAt(0);
            if ((code >= 48 && code <= 57) ||
                (code >= 65 && code <= 90) ||
                (code >= 97 && code <= 122)) {
                return char.toLowerCase();
            }
            return code.toString(16);
        })
            .join('')
            .slice(0, 50);
        return fallback || 'pake-app';
    }
    return cleaned;
}

async function mergeConfig(url, options, tauriConf) {
    // Ensure .pake directory exists and copy source templates if needed
    const srcTauriDir = path.join(npmDirectory, 'src-tauri');
    await fsExtra.ensureDir(tauriConfigDirectory);
    // Copy source config files to .pake directory (as templates)
    const sourceFiles = [
        'tauri.conf.json',
        'tauri.macos.conf.json',
        'tauri.windows.conf.json',
        'tauri.linux.conf.json',
        'pake.json',
    ];
    await Promise.all(sourceFiles.map(async (file) => {
        const sourcePath = path.join(srcTauriDir, file);
        const destPath = path.join(tauriConfigDirectory, file);
        if ((await fsExtra.pathExists(sourcePath)) &&
            !(await fsExtra.pathExists(destPath))) {
            await fsExtra.copy(sourcePath, destPath);
        }
    }));
    const { width, height, fullscreen, maximize, hideTitleBar, alwaysOnTop, appVersion, darkMode, disabledWebShortcuts, activationShortcut, userAgent, showSystemTray, systemTrayIcon, useLocalFile, identifier, name = 'pake-app', resizable = true, inject, proxyUrl, installerLanguage, hideOnClose, incognito, title, wasm, enableDragDrop, multiInstance, startToTray, forceInternalNavigation, zoom, minWidth, minHeight, ignoreCertificateErrors, newWindow, } = options;
    const { platform } = process;
    const platformHideOnClose = hideOnClose ?? platform === 'darwin';
    const tauriConfWindowOptions = {
        width,
        height,
        fullscreen,
        maximize,
        resizable,
        hide_title_bar: hideTitleBar,
        activation_shortcut: activationShortcut,
        always_on_top: alwaysOnTop,
        dark_mode: darkMode,
        disabled_web_shortcuts: disabledWebShortcuts,
        hide_on_close: platformHideOnClose,
        incognito: incognito,
        title: title,
        enable_wasm: wasm,
        enable_drag_drop: enableDragDrop,
        start_to_tray: startToTray && showSystemTray,
        force_internal_navigation: forceInternalNavigation,
        zoom,
        min_width: minWidth,
        min_height: minHeight,
        ignore_certificate_errors: ignoreCertificateErrors,
        new_window: newWindow,
    };
    Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });
    tauriConf.productName = name;
    tauriConf.identifier = identifier;
    tauriConf.version = appVersion;
    // Always set mainBinaryName to ensure binary uniqueness
    const linuxBinaryName = `pake-${generateLinuxPackageName(name)}`;
    tauriConf.mainBinaryName =
        platform === 'linux'
            ? linuxBinaryName
            : `pake-${generateIdentifierSafeName(name)}`;
    if (platform == 'win32') {
        tauriConf.bundle.windows.wix.language[0] = installerLanguage;
    }
    const pathExists = await fsExtra.pathExists(url);
    if (pathExists) {
        logger.warn('✼ Your input might be a local file.');
        tauriConf.pake.windows[0].url_type = 'local';
        const fileName = path.basename(url);
        const dirName = path.dirname(url);
        const distDir = path.join(npmDirectory, 'dist');
        const distBakDir = path.join(npmDirectory, 'dist_bak');
        if (!useLocalFile) {
            const urlPath = path.join(distDir, fileName);
            await fsExtra.copy(url, urlPath);
        }
        else {
            fsExtra.moveSync(distDir, distBakDir, { overwrite: true });
            fsExtra.copySync(dirName, distDir, { overwrite: true });
            // ignore it, because about_pake.html have be erased.
            // const filesToCopyBack = ['cli.js', 'about_pake.html'];
            const filesToCopyBack = ['cli.js'];
            await Promise.all(filesToCopyBack.map((file) => fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file))));
        }
        tauriConf.pake.windows[0].url = fileName;
        tauriConf.pake.windows[0].url_type = 'local';
    }
    else {
        tauriConf.pake.windows[0].url_type = 'web';
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
    tauriConf.pake.system_tray[currentPlatform] = showSystemTray;
    // Processing targets are currently only open to Linux.
    if (platform === 'linux') {
        // Remove hardcoded desktop files and regenerate with correct app name
        delete tauriConf.bundle.linux.deb.files;
        // Generate correct desktop file configuration
        const linuxName = generateLinuxPackageName(name);
        const desktopFileName = `com.pake.${linuxName}.desktop`;
        const iconName = `${linuxName}_512`;
        // Create desktop file content
        // Determine if title contains Chinese characters for Name[zh_CN]
        const chineseName = title && /[\u4e00-\u9fa5]/.test(title) ? title : null;
        const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
${chineseName ? `Name[zh_CN]=${chineseName}` : ''}
Comment=${name}
Exec=${linuxBinaryName}
Icon=${iconName}
Categories=Network;WebBrowser;Utility;
MimeType=text/html;text/xml;application/xhtml_xml;
StartupNotify=true
Terminal=false
`;
        // Write desktop file to src-tauri/assets directory where Tauri expects it
        const srcAssetsDir = path.join(npmDirectory, 'src-tauri/assets');
        const srcDesktopFilePath = path.join(srcAssetsDir, desktopFileName);
        await fsExtra.ensureDir(srcAssetsDir);
        await fsExtra.writeFile(srcDesktopFilePath, desktopContent);
        // Set up desktop file in bundle configuration
        // Use absolute path from src-tauri directory to assets
        const desktopInstallPath = `/usr/share/applications/${desktopFileName}`;
        tauriConf.bundle.linux.deb.files = {
            [desktopInstallPath]: `assets/${desktopFileName}`,
        };
        // Add desktop file support for RPM
        if (!tauriConf.bundle.linux.rpm) {
            tauriConf.bundle.linux.rpm = {};
        }
        tauriConf.bundle.linux.rpm.files = {
            [desktopInstallPath]: `assets/${desktopFileName}`,
        };
        const validTargets = [
            'deb',
            'appimage',
            'rpm',
            'deb-arm64',
            'appimage-arm64',
            'rpm-arm64',
        ];
        const baseTarget = options.targets.includes('-arm64')
            ? options.targets.replace('-arm64', '')
            : options.targets;
        if (validTargets.includes(options.targets)) {
            tauriConf.bundle.targets = [baseTarget];
        }
        else {
            logger.warn(`✼ The target must be one of ${validTargets.join(', ')}, the default 'deb' will be used.`);
        }
    }
    // Set macOS bundle targets (for app vs dmg)
    if (platform === 'darwin') {
        const validMacTargets = ['app', 'dmg'];
        if (validMacTargets.includes(options.targets)) {
            tauriConf.bundle.targets = [options.targets];
        }
    }
    // Set icon.
    const safeAppName = getSafeAppName(name);
    const platformIconMap = {
        win32: {
            fileExt: '.ico',
            path: `png/${safeAppName}_256.ico`,
            defaultIcon: 'png/icon_256.ico',
            message: 'Windows icon must be .ico and 256x256px.',
        },
        linux: {
            fileExt: '.png',
            path: `png/${generateLinuxPackageName(name)}_512.png`,
            defaultIcon: 'png/icon_512.png',
            message: 'Linux icon must be .png and 512x512px.',
        },
        darwin: {
            fileExt: '.icns',
            path: `icons/${safeAppName}.icns`,
            defaultIcon: 'icons/icon.icns',
            message: 'macOS icon must be .icns type.',
        },
    };
    const iconInfo = platformIconMap[platform];
    const resolvedIconPath = options.icon ? path.resolve(options.icon) : null;
    const exists = resolvedIconPath && (await fsExtra.pathExists(resolvedIconPath));
    if (exists) {
        let updateIconPath = true;
        let customIconExt = path.extname(resolvedIconPath).toLowerCase();
        if (customIconExt !== iconInfo.fileExt) {
            updateIconPath = false;
            logger.warn(`✼ ${iconInfo.message}, but you give ${customIconExt}`);
            tauriConf.bundle.icon = [iconInfo.defaultIcon];
        }
        else {
            const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
            tauriConf.bundle.resources = [iconInfo.path];
            // Avoid copying if source and destination are the same
            const absoluteDestPath = path.resolve(iconPath);
            if (resolvedIconPath !== absoluteDestPath) {
                await fsExtra.copy(resolvedIconPath, iconPath);
            }
        }
        if (updateIconPath) {
            tauriConf.bundle.icon = [iconInfo.path];
        }
        else {
            logger.warn(`✼ Icon will remain as default.`);
        }
    }
    else {
        logger.warn('✼ Custom icon path may be invalid, default icon will be used instead.');
        tauriConf.bundle.icon = [iconInfo.defaultIcon];
    }
    // Set tray icon path.
    let trayIconPath = platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon[0];
    if (systemTrayIcon.length > 0) {
        try {
            await fsExtra.pathExists(systemTrayIcon);
            // 需要判断图标格式，默认只支持ico和png两种
            let iconExt = path.extname(systemTrayIcon).toLowerCase();
            if (iconExt == '.png' || iconExt == '.ico') {
                const trayIcoPath = path.join(npmDirectory, `src-tauri/png/${safeAppName}${iconExt}`);
                trayIconPath = `png/${safeAppName}${iconExt}`;
                await fsExtra.copy(systemTrayIcon, trayIcoPath);
            }
            else {
                logger.warn(`✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`);
                logger.warn(`✼ Default system tray icon will be used.`);
            }
        }
        catch {
            logger.warn(`✼ ${systemTrayIcon} not exists!`);
            logger.warn(`✼ Default system tray icon will remain unchanged.`);
        }
    }
    // Ensure trayIcon object exists before setting iconPath
    if (!tauriConf.app.trayIcon) {
        tauriConf.app.trayIcon = {};
    }
    tauriConf.app.trayIcon.iconPath = trayIconPath;
    tauriConf.pake.system_tray_path = trayIconPath;
    delete tauriConf.app.trayIcon;
    const injectFilePath = path.join(npmDirectory, `src-tauri/src/inject/custom.js`);
    // inject js or css files
    if (inject?.length > 0) {
        // Ensure inject is an array before calling .every()
        const injectArray = Array.isArray(inject) ? inject : [inject];
        if (!injectArray.every((item) => item.endsWith('.css') || item.endsWith('.js'))) {
            logger.error('The injected file must be in either CSS or JS format.');
            return;
        }
        const files = injectArray.map((filepath) => path.isAbsolute(filepath) ? filepath : path.join(process.cwd(), filepath));
        tauriConf.pake.inject = files;
        await combineFiles(files, injectFilePath);
    }
    else {
        tauriConf.pake.inject = [];
        await fsExtra.writeFile(injectFilePath, '');
    }
    tauriConf.pake.proxy_url = proxyUrl || '';
    tauriConf.pake.multi_instance = multiInstance;
    // Configure WASM support with required HTTP headers
    if (wasm) {
        tauriConf.app.security = {
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            },
        };
    }
    // Save config file.
    const platformConfigPaths = {
        win32: 'tauri.windows.conf.json',
        darwin: 'tauri.macos.conf.json',
        linux: 'tauri.linux.conf.json',
    };
    const configPath = path.join(tauriConfigDirectory, platformConfigPaths[platform]);
    const bundleConf = { bundle: tauriConf.bundle };
    await fsExtra.outputJSON(configPath, bundleConf, { spaces: 4 });
    const pakeConfigPath = path.join(tauriConfigDirectory, 'pake.json');
    await fsExtra.outputJSON(pakeConfigPath, tauriConf.pake, { spaces: 4 });
    let tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
    delete tauriConf2.pake;
    const configJsonPath = path.join(tauriConfigDirectory, 'tauri.conf.json');
    await fsExtra.outputJSON(configJsonPath, tauriConf2, { spaces: 4 });
}

class BaseBuilder {
    constructor(options) {
        this.options = options;
    }
    getBuildEnvironment() {
        return IS_MAC
            ? {
                CFLAGS: '-fno-modules',
                CXXFLAGS: '-fno-modules',
                MACOSX_DEPLOYMENT_TARGET: '14.0',
            }
            : undefined;
    }
    getInstallTimeout() {
        // Windows needs more time due to native compilation and antivirus scanning
        return process.platform === 'win32' ? 900000 : 600000;
    }
    getBuildTimeout() {
        return 900000;
    }
    async detectPackageManager() {
        if (BaseBuilder.packageManagerCache) {
            return BaseBuilder.packageManagerCache;
        }
        const { execa } = await import('execa');
        try {
            await execa('pnpm', ['--version'], { stdio: 'ignore' });
            logger.info('✺ Using pnpm for package management.');
            BaseBuilder.packageManagerCache = 'pnpm';
            return 'pnpm';
        }
        catch {
            try {
                await execa('npm', ['--version'], { stdio: 'ignore' });
                logger.info('✺ pnpm not available, using npm for package management.');
                BaseBuilder.packageManagerCache = 'npm';
                return 'npm';
            }
            catch {
                throw new Error('Neither pnpm nor npm is available. Please install a package manager.');
            }
        }
    }
    async prepare() {
        const tauriSrcPath = path.join(npmDirectory, 'src-tauri');
        const tauriTargetPath = path.join(tauriSrcPath, 'target');
        const tauriTargetPathExists = await fsExtra.pathExists(tauriTargetPath);
        if (!IS_MAC && !tauriTargetPathExists) {
            logger.warn('✼ The first use requires installing system dependencies.');
            logger.warn('✼ See more in https://tauri.app/start/prerequisites/.');
        }
        ensureRustEnv();
        if (!checkRustInstalled()) {
            const res = await prompts({
                type: 'confirm',
                message: 'Rust not detected. Install now?',
                name: 'value',
            });
            if (res.value) {
                await installRust();
            }
            else {
                logger.error('✕ Rust required to package your webapp.');
                process.exit(0);
            }
        }
        const isChina = await isChinaDomain('www.npmjs.com');
        const spinner = getSpinner('Installing package...');
        const rustProjectDir = path.join(tauriSrcPath, '.cargo');
        const projectConf = path.join(rustProjectDir, 'config.toml');
        await fsExtra.ensureDir(rustProjectDir);
        // Detect available package manager
        const packageManager = await this.detectPackageManager();
        const registryOption = ' --registry=https://registry.npmmirror.com';
        const peerDepsOption = packageManager === 'npm' ? ' --legacy-peer-deps' : '';
        const timeout = this.getInstallTimeout();
        const buildEnv = this.getBuildEnvironment();
        // Show helpful message for first-time users
        if (!tauriTargetPathExists) {
            logger.info(process.platform === 'win32'
                ? '✺ First-time setup may take 10-15 minutes on Windows (compiling dependencies)...'
                : '✺ First-time setup may take 5-10 minutes (installing dependencies)...');
        }
        let usedMirror = isChina;
        try {
            if (isChina) {
                logger.info(`✺ Located in China, using ${packageManager}/rsProxy CN mirror.`);
                const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
                await fsExtra.copy(projectCnConf, projectConf);
                await shellExec(`cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption}`, timeout, { ...buildEnv, CI: 'true' });
            }
            else {
                await shellExec(`cd "${npmDirectory}" && ${packageManager} install${peerDepsOption}`, timeout, { ...buildEnv, CI: 'true' });
            }
            spinner.succeed(chalk.green('Package installed!'));
        }
        catch (error) {
            // If installation times out and we haven't tried the mirror yet, retry with mirror
            if (error instanceof Error &&
                error.message.includes('timed out') &&
                !usedMirror) {
                spinner.fail(chalk.yellow('Installation timed out, retrying with CN mirror...'));
                logger.info('✺ Retrying installation with CN mirror for better speed...');
                const retrySpinner = getSpinner('Retrying installation...');
                usedMirror = true;
                try {
                    const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
                    await fsExtra.copy(projectCnConf, projectConf);
                    await shellExec(`cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption}`, timeout, { ...buildEnv, CI: 'true' });
                    retrySpinner.succeed(chalk.green('Package installed with CN mirror!'));
                }
                catch (retryError) {
                    retrySpinner.fail(chalk.red('Installation failed'));
                    throw retryError;
                }
            }
            else {
                spinner.fail(chalk.red('Installation failed'));
                throw error;
            }
        }
        if (!tauriTargetPathExists) {
            logger.warn('✼ The first packaging may be slow, please be patient and wait, it will be faster afterwards.');
        }
    }
    async build(url) {
        await this.buildAndCopy(url, this.options.targets);
    }
    async start(url) {
        logger.info('Pake dev server starting...');
        await mergeConfig(url, this.options, tauriConfig);
        const packageManager = await this.detectPackageManager();
        const configPath = path.join(npmDirectory, 'src-tauri', '.pake', 'tauri.conf.json');
        const features = this.getBuildFeatures();
        const featureArgs = features.length > 0 ? `--features ${features.join(',')}` : '';
        const argSeparator = packageManager === 'npm' ? ' --' : '';
        const command = `cd "${npmDirectory}" && ${packageManager} run tauri${argSeparator} dev --config "${configPath}" ${featureArgs}`;
        await shellExec(command);
    }
    async buildAndCopy(url, target) {
        const { name = 'pake-app' } = this.options;
        await mergeConfig(url, this.options, tauriConfig);
        // Detect available package manager
        const packageManager = await this.detectPackageManager();
        // Build app
        const buildSpinner = getSpinner('Building app...');
        // Let spinner run for a moment so user can see it, then stop before package manager command
        await new Promise((resolve) => setTimeout(resolve, 500));
        buildSpinner.stop();
        // Show static message to keep the status visible
        logger.warn('✸ Building app...');
        const baseEnv = this.getBuildEnvironment();
        let buildEnv = {
            ...(baseEnv ?? {}),
            ...(process.env.NO_STRIP ? { NO_STRIP: process.env.NO_STRIP } : {}),
        };
        const resolveExecEnv = () => Object.keys(buildEnv).length > 0 ? buildEnv : undefined;
        // Warn users about potential AppImage build failures on modern Linux systems.
        // The linuxdeploy tool bundled in Tauri uses an older strip tool that doesn't
        // recognize the .relr.dyn section introduced in glibc 2.38+.
        if (process.platform === 'linux' && target === 'appimage') {
            if (!buildEnv.NO_STRIP) {
                logger.warn('⚠ Building AppImage on Linux may fail due to strip incompatibility with glibc 2.38+');
                logger.warn('⚠ If build fails, retry with: NO_STRIP=1 pake <url> --targets appimage');
            }
        }
        const buildCommand = `cd "${npmDirectory}" && ${this.getBuildCommand(packageManager)}`;
        const buildTimeout = this.getBuildTimeout();
        try {
            await shellExec(buildCommand, buildTimeout, resolveExecEnv());
        }
        catch (error) {
            const shouldRetryWithoutStrip = process.platform === 'linux' &&
                target === 'appimage' &&
                !buildEnv.NO_STRIP &&
                this.isLinuxDeployStripError(error);
            if (shouldRetryWithoutStrip) {
                logger.warn('⚠ AppImage build failed during linuxdeploy strip step, retrying with NO_STRIP=1 automatically.');
                buildEnv = {
                    ...buildEnv,
                    NO_STRIP: '1',
                };
                await shellExec(buildCommand, buildTimeout, resolveExecEnv());
            }
            else {
                throw error;
            }
        }
        // Copy app
        const fileName = this.getFileName();
        const fileType = this.getFileType(target);
        const appPath = this.getBuildAppPath(npmDirectory, fileName, fileType);
        const distPath = path.resolve(`${name}.${fileType}`);
        await fsExtra.copy(appPath, distPath);
        // Copy raw binary if requested
        if (this.options.keepBinary) {
            await this.copyRawBinary(npmDirectory, name);
        }
        await fsExtra.remove(appPath);
        logger.success('✔ Build success!');
        logger.success('✔ App installer located in', distPath);
        // Log binary location if preserved
        if (this.options.keepBinary) {
            const binaryPath = this.getRawBinaryPath(name);
            logger.success('✔ Raw binary located in', path.resolve(binaryPath));
        }
    }
    getFileType(target) {
        return target;
    }
    isLinuxDeployStripError(error) {
        if (!(error instanceof Error) || !error.message) {
            return false;
        }
        const message = error.message.toLowerCase();
        return (message.includes('linuxdeploy') ||
            message.includes('failed to run linuxdeploy') ||
            message.includes('strip:') ||
            message.includes('unable to recognise the format of the input file') ||
            message.includes('appimage tool failed') ||
            message.includes('strip tool'));
    }
    /**
     * 解析目标架构
     */
    resolveTargetArch(requestedArch) {
        if (requestedArch === 'auto' || !requestedArch) {
            return process.arch;
        }
        return requestedArch;
    }
    /**
     * 获取Tauri构建目标
     */
    getTauriTarget(arch, platform = process.platform) {
        const platformMappings = BaseBuilder.ARCH_MAPPINGS[platform];
        if (!platformMappings)
            return null;
        return platformMappings[arch] || null;
    }
    /**
     * 获取架构显示名称（用于文件名）
     */
    getArchDisplayName(arch) {
        return BaseBuilder.ARCH_DISPLAY_NAMES[arch] || arch;
    }
    /**
     * 构建基础构建命令
     */
    buildBaseCommand(packageManager, configPath, target) {
        const baseCommand = this.options.debug
            ? `${packageManager} run build:debug`
            : `${packageManager} run build`;
        const argSeparator = packageManager === 'npm' ? ' --' : '';
        let fullCommand = `${baseCommand}${argSeparator} -c "${configPath}"`;
        if (target) {
            fullCommand += ` --target ${target}`;
        }
        // Enable verbose output in debug mode to help diagnose build issues.
        // This provides detailed logs from Tauri CLI and bundler tools.
        if (this.options.debug) {
            fullCommand += ' --verbose';
        }
        return fullCommand;
    }
    /**
     * 获取构建特性列表
     */
    getBuildFeatures() {
        const features = ['cli-build'];
        // Add macos-proxy feature for modern macOS (Darwin 23+ = macOS 14+)
        if (IS_MAC) {
            const macOSVersion = this.getMacOSMajorVersion();
            if (macOSVersion >= 23) {
                features.push('macos-proxy');
            }
        }
        return features;
    }
    getBuildCommand(packageManager = 'pnpm') {
        // Use temporary config directory to avoid modifying source files
        const configPath = path.join(npmDirectory, 'src-tauri', '.pake', 'tauri.conf.json');
        let fullCommand = this.buildBaseCommand(packageManager, configPath);
        // For macOS, use app bundles by default unless DMG is explicitly requested
        if (IS_MAC && this.options.targets === 'app') {
            fullCommand += ' --bundles app';
        }
        // Add features
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getMacOSMajorVersion() {
        try {
            const os = require('os');
            const release = os.release();
            const majorVersion = parseInt(release.split('.')[0], 10);
            return majorVersion;
        }
        catch (error) {
            return 0; // Disable proxy feature if version detection fails
        }
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        return `src-tauri/target/${basePath}/bundle/`;
    }
    getBuildAppPath(npmDirectory, fileName, fileType) {
        // For app bundles on macOS, the directory is 'macos', not 'app'
        const bundleDir = fileType.toLowerCase() === 'app' ? 'macos' : fileType.toLowerCase();
        return path.join(npmDirectory, this.getBasePath(), bundleDir, `${fileName}.${fileType}`);
    }
    /**
     * Copy raw binary file to output directory
     */
    async copyRawBinary(npmDirectory, appName) {
        const binaryPath = this.getRawBinarySourcePath(npmDirectory, appName);
        const outputPath = this.getRawBinaryPath(appName);
        if (await fsExtra.pathExists(binaryPath)) {
            await fsExtra.copy(binaryPath, outputPath);
            // Make binary executable on Unix-like systems
            if (process.platform !== 'win32') {
                await fsExtra.chmod(outputPath, 0o755);
            }
        }
        else {
            logger.warn(`✼ Raw binary not found at ${binaryPath}, skipping...`);
        }
    }
    /**
     * Get the source path of the raw binary file in the build directory
     */
    getRawBinarySourcePath(npmDirectory, appName) {
        const basePath = this.options.debug ? 'debug' : 'release';
        const binaryName = this.getBinaryName(appName);
        // Handle cross-platform builds
        if (this.options.multiArch || this.hasArchSpecificTarget()) {
            return path.join(npmDirectory, this.getArchSpecificPath(), basePath, binaryName);
        }
        return path.join(npmDirectory, 'src-tauri/target', basePath, binaryName);
    }
    /**
     * Get the output path for the raw binary file
     */
    getRawBinaryPath(appName) {
        const extension = process.platform === 'win32' ? '.exe' : '';
        const suffix = process.platform === 'win32' ? '' : '-binary';
        return `${appName}${suffix}${extension}`;
    }
    /**
     * Get the binary name based on app name and platform
     */
    getBinaryName(appName) {
        const extension = process.platform === 'win32' ? '.exe' : '';
        // Use unique binary name for all platforms to avoid conflicts
        const nameToUse = process.platform === 'linux'
            ? generateLinuxPackageName(appName)
            : generateIdentifierSafeName(appName);
        return `pake-${nameToUse}${extension}`;
    }
    /**
     * Check if this build has architecture-specific target
     */
    hasArchSpecificTarget() {
        return false; // Override in subclasses if needed
    }
    /**
     * Get architecture-specific path for binary
     */
    getArchSpecificPath() {
        return 'src-tauri/target'; // Override in subclasses if needed
    }
}
BaseBuilder.packageManagerCache = null;
// 架构映射配置
BaseBuilder.ARCH_MAPPINGS = {
    darwin: {
        arm64: 'aarch64-apple-darwin',
        x64: 'x86_64-apple-darwin',
        universal: 'universal-apple-darwin',
    },
    win32: {
        arm64: 'aarch64-pc-windows-msvc',
        x64: 'x86_64-pc-windows-msvc',
    },
    linux: {
        arm64: 'aarch64-unknown-linux-gnu',
        x64: 'x86_64-unknown-linux-gnu',
    },
};
// 架构名称映射（用于文件名生成）
BaseBuilder.ARCH_DISPLAY_NAMES = {
    arm64: 'aarch64',
    x64: 'x64',
    universal: 'universal',
};

class MacBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        const validArchs = ['intel', 'apple', 'universal', 'auto', 'x64', 'arm64'];
        this.buildArch = validArchs.includes(options.targets || '')
            ? options.targets
            : 'auto';
        if (options.iterativeBuild || process.env.PAKE_CREATE_APP === '1') {
            this.buildFormat = 'app';
        }
        else {
            this.buildFormat = 'dmg';
        }
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name = 'pake-app' } = this.options;
        if (this.buildFormat === 'app') {
            return name;
        }
        let arch;
        if (this.buildArch === 'universal' || this.options.multiArch) {
            arch = 'universal';
        }
        else if (this.buildArch === 'apple') {
            arch = 'aarch64';
        }
        else if (this.buildArch === 'intel') {
            arch = 'x64';
        }
        else {
            arch = this.getArchDisplayName(this.resolveTargetArch(this.buildArch));
        }
        return `${name}_${tauriConfig.version}_${arch}`;
    }
    getActualArch() {
        if (this.buildArch === 'universal' || this.options.multiArch) {
            return 'universal';
        }
        else if (this.buildArch === 'apple') {
            return 'arm64';
        }
        else if (this.buildArch === 'intel') {
            return 'x64';
        }
        return this.resolveTargetArch(this.buildArch);
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const actualArch = this.getActualArch();
        const buildTarget = this.getTauriTarget(actualArch, 'darwin');
        if (!buildTarget) {
            throw new Error(`Unsupported architecture: ${actualArch} for macOS`);
        }
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        const actualArch = this.getActualArch();
        const target = this.getTauriTarget(actualArch, 'darwin');
        return `src-tauri/target/${target}/${basePath}/bundle`;
    }
    hasArchSpecificTarget() {
        return true;
    }
    getArchSpecificPath() {
        const actualArch = this.getActualArch();
        const target = this.getTauriTarget(actualArch, 'darwin');
        return `src-tauri/target/${target}`;
    }
}

class WinBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        this.buildFormat = 'msi';
        const validArchs = ['x64', 'arm64', 'auto'];
        this.buildArch = validArchs.includes(options.targets || '')
            ? this.resolveTargetArch(options.targets)
            : this.resolveTargetArch('auto');
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name } = this.options;
        const language = tauriConfig.bundle.windows.wix.language[0];
        const targetArch = this.getArchDisplayName(this.buildArch);
        return `${name}_${tauriConfig.version}_${targetArch}_${language}`;
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const buildTarget = this.getTauriTarget(this.buildArch, 'win32');
        if (!buildTarget) {
            throw new Error(`Unsupported architecture: ${this.buildArch} for Windows`);
        }
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        const target = this.getTauriTarget(this.buildArch, 'win32');
        return `src-tauri/target/${target}/${basePath}/bundle/`;
    }
    hasArchSpecificTarget() {
        return true;
    }
    getArchSpecificPath() {
        const target = this.getTauriTarget(this.buildArch, 'win32');
        return `src-tauri/target/${target}`;
    }
}

class LinuxBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        this.currentBuildType = '';
        const target = options.targets || 'deb';
        if (target.includes('-arm64')) {
            this.buildFormat = target.replace('-arm64', '');
            this.buildArch = 'arm64';
        }
        else {
            this.buildFormat = target;
            this.buildArch = this.resolveTargetArch('auto');
        }
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name = 'pake-app', targets } = this.options;
        const version = tauriConfig.version;
        const buildType = this.currentBuildType || targets.split(',').map((t) => t.trim())[0];
        let arch;
        if (this.buildArch === 'arm64') {
            arch =
                buildType === 'rpm' || buildType === 'appimage' ? 'aarch64' : 'arm64';
        }
        else {
            if (this.buildArch === 'x64') {
                arch = buildType === 'rpm' ? 'x86_64' : 'amd64';
            }
            else {
                arch = this.buildArch;
                if (this.buildArch === 'arm64' &&
                    (buildType === 'rpm' || buildType === 'appimage')) {
                    arch = 'aarch64';
                }
            }
        }
        if (this.currentBuildType === 'rpm') {
            return `${name}-${version}-1.${arch}`;
        }
        return `${name}_${version}_${arch}`;
    }
    async build(url) {
        const targetTypes = ['deb', 'appimage', 'rpm'];
        const requestedTargets = this.options.targets
            .split(',')
            .map((t) => t.trim());
        for (const target of targetTypes) {
            if (requestedTargets.includes(target)) {
                this.currentBuildType = target;
                await this.buildAndCopy(url, target);
            }
        }
    }
    // Override buildAndCopy to ensure currentBuildType is synced if called directly, though the loop above handles it most of the time.
    async buildAndCopy(url, target) {
        this.currentBuildType = target;
        await super.buildAndCopy(url, target);
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const buildTarget = this.buildArch === 'arm64'
            ? (this.getTauriTarget(this.buildArch, 'linux') ?? undefined)
            : undefined;
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        if (this.currentBuildType) {
            fullCommand += ` --bundles ${this.currentBuildType}`;
        }
        // Enable verbose output for AppImage builds when debugging or PAKE_VERBOSE is set.
        // AppImage builds often fail with minimal error messages from linuxdeploy,
        // so verbose mode helps diagnose issues like strip failures and missing dependencies.
        if (this.currentBuildType === 'appimage' &&
            (this.options.targets.includes('appimage') ||
                this.options.debug ||
                process.env.PAKE_VERBOSE)) {
            fullCommand += ' --verbose';
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        if (this.buildArch === 'arm64') {
            const target = this.getTauriTarget(this.buildArch, 'linux');
            return `src-tauri/target/${target}/${basePath}/bundle/`;
        }
        return super.getBasePath();
    }
    getFileType(target) {
        if (target === 'appimage') {
            return 'AppImage';
        }
        return super.getFileType(target);
    }
    hasArchSpecificTarget() {
        return this.buildArch === 'arm64';
    }
    getArchSpecificPath() {
        if (this.buildArch === 'arm64') {
            const target = this.getTauriTarget(this.buildArch, 'linux');
            return `src-tauri/target/${target}`;
        }
        return super.getArchSpecificPath();
    }
}

const { platform } = process;
const buildersMap = {
    darwin: MacBuilder,
    win32: WinBuilder,
    linux: LinuxBuilder,
};
class BuilderProvider {
    static create(options) {
        const Builder = buildersMap[platform];
        if (!Builder) {
            throw new Error('The current system is not supported!');
        }
        return new Builder(options);
    }
}

const ICON_CONFIG = {
    minFileSize: 100,
    supportedFormats: ['png', 'ico', 'jpeg', 'jpg', 'webp', 'icns'],
    whiteBackground: { r: 255, g: 255, b: 255 },
    transparentBackground: { r: 255, g: 255, b: 255, alpha: 0 },
    downloadTimeout: {
        ci: 5000,
        default: 15000,
    },
};
const PLATFORM_CONFIG = {
    win: { format: '.ico', sizes: [16, 32, 48, 64, 128, 256] },
    linux: { format: '.png', size: 512 },
    macos: { format: '.icns', sizes: [16, 32, 64, 128, 256, 512, 1024] },
};
const API_KEYS = {
    logoDev: ['pk_JLLMUKGZRpaG5YclhXaTkg', 'pk_Ph745P8mQSeYFfW2Wk039A'],
    brandfetch: ['1idqvJC0CeFSeyp3Yf7', '1idej-yhU_ThggIHFyG'],
};
function generateIconPath(appName, isDefault = false) {
    const safeName = isDefault ? 'icon' : getIconBaseName(appName);
    const baseName = safeName;
    if (IS_WIN) {
        return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_256.ico`);
    }
    if (IS_LINUX) {
        return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_512.png`);
    }
    return path.join(npmDirectory, 'src-tauri', 'icons', `${baseName}.icns`);
}
function getIconBaseName(appName) {
    const baseName = IS_LINUX
        ? generateLinuxPackageName(appName)
        : generateSafeFilename(appName).toLowerCase();
    return baseName || 'pake-app';
}
async function copyWindowsIconIfNeeded(convertedPath, appName) {
    if (!IS_WIN || !convertedPath.endsWith('.ico')) {
        return convertedPath;
    }
    try {
        const finalIconPath = generateIconPath(appName);
        await fsExtra.ensureDir(path.dirname(finalIconPath));
        await fsExtra.copy(convertedPath, finalIconPath);
        return finalIconPath;
    }
    catch (error) {
        logger.warn(`Failed to copy Windows icon: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return convertedPath;
    }
}
/**
 * Adds white background to transparent icons only
 */
async function preprocessIcon(inputPath) {
    try {
        const metadata = await sharp(inputPath).metadata();
        if (metadata.channels !== 4)
            return inputPath; // No transparency
        const { path: tempDir } = await dir();
        const outputPath = path.join(tempDir, 'icon-with-background.png');
        await sharp({
            create: {
                width: metadata.width || 512,
                height: metadata.height || 512,
                channels: 4,
                background: { ...ICON_CONFIG.whiteBackground, alpha: 1 },
            },
        })
            .composite([{ input: inputPath }])
            .png()
            .toFile(outputPath);
        return outputPath;
    }
    catch (error) {
        if (error instanceof Error) {
            logger.warn(`Failed to add background to icon: ${error.message}`);
        }
        return inputPath;
    }
}
/**
 * Applies macOS squircle mask to icon
 */
async function applyMacOSMask(inputPath) {
    try {
        const { path: tempDir } = await dir();
        const outputPath = path.join(tempDir, 'icon-macos-rounded.png');
        // 1. Create a 1024x1024 rounded rect mask
        // rx="224" is closer to the smooth Apple squircle look for 1024px
        const mask = Buffer.from('<svg width="1024" height="1024"><rect x="0" y="0" width="1024" height="1024" rx="224" ry="224" fill="white"/></svg>');
        // 2. Load input, resize to 1024, apply mask
        const maskedBuffer = await sharp(inputPath)
            .resize(1024, 1024, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
            .composite([
            {
                input: mask,
                blend: 'dest-in',
            },
        ])
            .png()
            .toBuffer();
        // 3. Resize to 840x840 (~18% padding) to solve "too big" visual issue
        // Native MacOS icons often leave some breathing room
        await sharp(maskedBuffer)
            .resize(840, 840, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
            .extend({
            top: 92,
            bottom: 92,
            left: 92,
            right: 92,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
            .toFile(outputPath);
        return outputPath;
    }
    catch (error) {
        if (error instanceof Error) {
            logger.warn(`Failed to apply macOS mask: ${error.message}`);
        }
        return inputPath;
    }
}
/**
 * Converts icon to platform-specific format
 */
async function convertIconFormat(inputPath, appName) {
    try {
        if (!(await fsExtra.pathExists(inputPath)))
            return null;
        const { path: outputDir } = await dir();
        const platformOutputDir = path.join(outputDir, 'converted-icons');
        await fsExtra.ensureDir(platformOutputDir);
        const processedInputPath = await preprocessIcon(inputPath);
        const iconName = getIconBaseName(appName);
        // Generate platform-specific format
        if (IS_WIN) {
            // Support multiple sizes for better Windows compatibility
            await icongen(processedInputPath, platformOutputDir, {
                report: false,
                ico: {
                    name: `${iconName}_256`,
                    sizes: PLATFORM_CONFIG.win.sizes,
                },
            });
            return path.join(platformOutputDir, `${iconName}_256${PLATFORM_CONFIG.win.format}`);
        }
        if (IS_LINUX) {
            const outputPath = path.join(platformOutputDir, `${iconName}_${PLATFORM_CONFIG.linux.size}${PLATFORM_CONFIG.linux.format}`);
            // Ensure we convert to proper PNG format with correct size
            await sharp(processedInputPath)
                .resize(PLATFORM_CONFIG.linux.size, PLATFORM_CONFIG.linux.size, {
                fit: 'contain',
                background: ICON_CONFIG.transparentBackground,
            })
                .ensureAlpha()
                .png()
                .toFile(outputPath);
            return outputPath;
        }
        // macOS
        const macIconPath = await applyMacOSMask(processedInputPath);
        await icongen(macIconPath, platformOutputDir, {
            report: false,
            icns: { name: iconName, sizes: PLATFORM_CONFIG.macos.sizes },
        });
        const outputPath = path.join(platformOutputDir, `${iconName}${PLATFORM_CONFIG.macos.format}`);
        return (await fsExtra.pathExists(outputPath)) ? outputPath : null;
    }
    catch (error) {
        if (error instanceof Error) {
            logger.warn(`Icon format conversion failed: ${error.message}`);
        }
        return null;
    }
}
/**
 * Processes downloaded or local icon for platform-specific format
 */
async function processIcon(iconPath, appName) {
    if (!iconPath || !appName)
        return iconPath;
    // Check if already in correct platform format
    const ext = path.extname(iconPath).toLowerCase();
    const isCorrectFormat = (IS_WIN && ext === '.ico') ||
        (IS_LINUX && ext === '.png') ||
        (!IS_WIN && !IS_LINUX && ext === '.icns');
    if (isCorrectFormat) {
        return await copyWindowsIconIfNeeded(iconPath, appName);
    }
    // Convert to platform format
    const convertedPath = await convertIconFormat(iconPath, appName);
    if (convertedPath) {
        return await copyWindowsIconIfNeeded(convertedPath, appName);
    }
    return iconPath;
}
/**
 * Gets default icon with platform-specific fallback logic
 */
async function getDefaultIcon() {
    logger.info('✼ No icon provided, using default icon.');
    if (IS_WIN) {
        const defaultIcoPath = generateIconPath('icon', true);
        const defaultPngPath = path.join(npmDirectory, 'src-tauri/png/icon_512.png');
        // Try default ico first
        if (await fsExtra.pathExists(defaultIcoPath)) {
            return defaultIcoPath;
        }
        // Convert from png if ico doesn't exist
        if (await fsExtra.pathExists(defaultPngPath)) {
            logger.info('✼ Default ico not found, converting from png...');
            try {
                const convertedPath = await convertIconFormat(defaultPngPath, 'icon');
                if (convertedPath && (await fsExtra.pathExists(convertedPath))) {
                    return await copyWindowsIconIfNeeded(convertedPath, 'icon');
                }
            }
            catch (error) {
                logger.warn(`Failed to convert default png to ico: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        // Fallback to png or empty
        if (await fsExtra.pathExists(defaultPngPath)) {
            logger.warn('✼ Using png as fallback for Windows (may cause issues).');
            return defaultPngPath;
        }
        logger.warn('✼ No default icon found, will use pake default.');
        return '';
    }
    // Linux and macOS defaults
    const iconPath = IS_LINUX
        ? 'src-tauri/png/icon_512.png'
        : 'src-tauri/icons/icon.icns';
    return path.join(npmDirectory, iconPath);
}
/**
 * Main icon handling function with simplified logic flow
 */
async function handleIcon(options, url) {
    // Handle custom icon (local file or remote URL)
    if (options.icon) {
        if (options.icon.startsWith('http')) {
            const downloadedPath = await downloadIcon(options.icon);
            if (downloadedPath) {
                const result = await processIcon(downloadedPath, options.name || '');
                if (result)
                    return result;
            }
            return '';
        }
        // Local file path
        const resolvedPath = path.resolve(options.icon);
        const result = await processIcon(resolvedPath, options.name || '');
        return result || resolvedPath;
    }
    // Check for existing local icon before downloading
    if (options.name) {
        const localIconPath = generateIconPath(options.name);
        if (await fsExtra.pathExists(localIconPath)) {
            logger.info(`✼ Using existing local icon: ${localIconPath}`);
            return localIconPath;
        }
    }
    // Try favicon from website
    if (url && options.name) {
        const faviconPath = await tryGetFavicon(url, options.name);
        if (faviconPath)
            return faviconPath;
    }
    // Use default icon
    return await getDefaultIcon();
}
/**
 * Generates icon service URLs for a domain
 */
function generateIconServiceUrls(domain) {
    const logoDevUrls = API_KEYS.logoDev
        .sort(() => Math.random() - 0.5)
        .map((token) => `https://img.logo.dev/${domain}?token=${token}&format=png&size=256`);
    const brandfetchUrls = API_KEYS.brandfetch
        .sort(() => Math.random() - 0.5)
        .map((key) => `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${key}`);
    return [
        ...logoDevUrls,
        ...brandfetchUrls,
        `https://logo.clearbit.com/${domain}?size=256`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
        `https://favicon.is/${domain}`,
        `https://${domain}/favicon.ico`,
        `https://www.${domain}/favicon.ico`,
    ];
}
/**
 * Attempts to fetch favicon from website
 */
async function tryGetFavicon(url, appName) {
    try {
        const domain = new URL(url).hostname;
        const spinner = getSpinner(`Fetching icon from ${domain}...`);
        const serviceUrls = generateIconServiceUrls(domain);
        const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
        const downloadTimeout = isCI
            ? ICON_CONFIG.downloadTimeout.ci
            : ICON_CONFIG.downloadTimeout.default;
        for (const serviceUrl of serviceUrls) {
            try {
                const faviconPath = await downloadIcon(serviceUrl, false, downloadTimeout);
                if (!faviconPath)
                    continue;
                const convertedPath = await convertIconFormat(faviconPath, appName);
                if (convertedPath) {
                    const finalPath = await copyWindowsIconIfNeeded(convertedPath, appName);
                    spinner.succeed(chalk.green('Icon fetched and converted successfully!'));
                    return finalPath;
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    logger.debug(`Icon service ${serviceUrl} failed: ${error.message}`);
                }
                continue;
            }
        }
        spinner.warn(`No favicon found for ${domain}. Using default.`);
        return null;
    }
    catch (error) {
        if (error instanceof Error) {
            logger.warn(`Failed to fetch favicon: ${error.message}`);
        }
        return null;
    }
}
/**
 * Downloads icon from URL
 */
async function downloadIcon(iconUrl, showSpinner = true, customTimeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, customTimeout || 10000);
    try {
        const response = await fetch(iconUrl, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            if (response.status === 404 && !showSpinner) {
                return null;
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength < ICON_CONFIG.minFileSize)
            return null;
        const fileDetails = await fileTypeFromBuffer(arrayBuffer);
        if (!fileDetails ||
            !ICON_CONFIG.supportedFormats.includes(fileDetails.ext)) {
            return null;
        }
        return await saveIconFile(arrayBuffer, fileDetails.ext);
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (showSpinner) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.error('Icon download timed out!');
            }
            else {
                logger.error('Icon download failed!', error instanceof Error ? error.message : String(error));
            }
        }
        return null;
    }
}
/**
 * Saves icon file to temporary location
 */
async function saveIconFile(iconData, extension) {
    const buffer = Buffer.from(iconData);
    const { path: tempPath } = await dir();
    // Always save with the original extension first
    const originalIconPath = path.join(tempPath, `icon.${extension}`);
    await fsExtra.outputFile(originalIconPath, buffer);
    return originalIconPath;
}

// Extracts the domain from a given URL.
function getDomain(inputUrl) {
    try {
        const url = new URL(inputUrl);
        // Use PSL to parse domain names.
        const parsed = psl.parse(url.hostname);
        // If domain is available, split it and return the SLD.
        if ('domain' in parsed && parsed.domain) {
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
    try {
        new URL(urlWithProtocol);
        return urlWithProtocol;
    }
    catch (err) {
        throw new Error(`Your url "${urlWithProtocol}" is invalid: ${err.message}`);
    }
}

function resolveAppName(name, platform) {
    const domain = getDomain(name) || 'pake';
    return platform !== 'linux' ? capitalizeFirstLetter(domain) : domain;
}
function resolveLocalAppName(filePath, platform) {
    const baseName = path.parse(filePath).name || 'pake-app';
    if (platform === 'linux') {
        return generateLinuxPackageName(baseName) || 'pake-app';
    }
    const normalized = baseName
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff -]/g, '')
        .replace(/^[ -]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return normalized || 'pake-app';
}
function isValidName(name, platform) {
    const platformRegexMapping = {
        linux: /^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]*$/,
        default: /^[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff- ]*$/,
    };
    const reg = platformRegexMapping[platform] || platformRegexMapping.default;
    return !!name && reg.test(name);
}
async function handleOptions(options, url) {
    const { platform } = process;
    const isActions = process.env.GITHUB_ACTIONS;
    let name = options.name;
    const pathExists = await fsExtra.pathExists(url);
    if (!options.name) {
        const defaultName = pathExists
            ? resolveLocalAppName(url, platform)
            : resolveAppName(url, platform);
        const promptMessage = 'Enter your application name';
        const namePrompt = await promptText(promptMessage, defaultName);
        name = namePrompt?.trim() || defaultName;
    }
    if (name && platform === 'linux') {
        name = generateLinuxPackageName(name);
    }
    if (name && !isValidName(name, platform)) {
        const LINUX_NAME_ERROR = `✕ Name should only include lowercase letters, numbers, and dashes (not leading dashes). Examples: com-123-xxx, 123pan, pan123, weread, we-read, 123.`;
        const DEFAULT_NAME_ERROR = `✕ Name should only include letters, numbers, dashes, and spaces (not leading dashes and spaces). Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead, we-read, We Read, 123.`;
        const errorMsg = platform === 'linux' ? LINUX_NAME_ERROR : DEFAULT_NAME_ERROR;
        logger.error(errorMsg);
        if (isActions) {
            name = resolveAppName(url, platform);
            logger.warn(`✼ Inside github actions, use the default name: ${name}`);
        }
        else {
            process.exit(1);
        }
    }
    const appOptions = {
        ...options,
        name,
        identifier: getIdentifier(url),
    };
    const iconPath = await handleIcon(appOptions, url);
    appOptions.icon = iconPath || '';
    return appOptions;
}

const DEFAULT_PAKE_OPTIONS = {
    icon: '',
    height: 780,
    width: 1200,
    fullscreen: false,
    maximize: false,
    hideTitleBar: false,
    alwaysOnTop: false,
    appVersion: '1.0.0',
    darkMode: false,
    disabledWebShortcuts: false,
    activationShortcut: '',
    userAgent: '',
    showSystemTray: false,
    multiArch: false,
    targets: (() => {
        switch (process.platform) {
            case 'linux':
                return 'deb,appimage';
            case 'darwin':
                return 'dmg';
            case 'win32':
                return 'msi';
            default:
                return 'deb';
        }
    })(),
    useLocalFile: false,
    systemTrayIcon: '',
    proxyUrl: '',
    debug: false,
    inject: [],
    installerLanguage: 'en-US',
    hideOnClose: undefined, // Platform-specific: true for macOS, false for others
    incognito: false,
    wasm: false,
    enableDragDrop: false,
    keepBinary: false,
    multiInstance: false,
    startToTray: false,
    forceInternalNavigation: false,
    iterativeBuild: false,
    zoom: 100,
    minWidth: 0,
    minHeight: 0,
    ignoreCertificateErrors: false,
    newWindow: false,
};

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
            if (error instanceof Error) {
                throw new InvalidArgumentError(error.message);
            }
            throw error;
        }
    }
    return url;
}

function getCliProgram() {
    const { green, yellow } = chalk;
    const logo = `${chalk.green(' ____       _')}
${green('|  _ \\ __ _| | _____')}
${green('| |_) / _` | |/ / _ \\')}
${green('|  __/ (_| |   <  __/')}  ${yellow('https://github.com/tw93/pake')}
${green('|_|   \\__,_|_|\\_\\___|  can turn any webpage into a desktop app with Rust.')}
`;
    return program$1
        .addHelpText('beforeAll', logo)
        .usage(`[url] [options]`)
        .showHelpAfterError()
        .argument('[url]', 'The web URL you want to package', validateUrlInput)
        .option('--name <string>', 'Application name')
        .option('--icon <string>', 'Application icon', DEFAULT_PAKE_OPTIONS.icon)
        .option('--width <number>', 'Window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
        .option('--height <number>', 'Window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
        .option('--use-local-file', 'Use local file packaging', DEFAULT_PAKE_OPTIONS.useLocalFile)
        .option('--fullscreen', 'Start in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
        .option('--hide-title-bar', 'For Mac, hide title bar', DEFAULT_PAKE_OPTIONS.hideTitleBar)
        .option('--multi-arch', 'For Mac, both Intel and M1', DEFAULT_PAKE_OPTIONS.multiArch)
        .option('--inject <files>', 'Inject local CSS/JS files into the page', (val, previous) => {
        if (!val)
            return DEFAULT_PAKE_OPTIONS.inject;
        // Split by comma and trim whitespace, filter out empty strings
        const files = val
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        // If previous values exist (from multiple --inject options), merge them
        return previous ? [...previous, ...files] : files;
    }, DEFAULT_PAKE_OPTIONS.inject)
        .option('--debug', 'Debug build and more output', DEFAULT_PAKE_OPTIONS.debug)
        .addOption(new Option('--proxy-url <url>', 'Proxy URL for all network requests (http://, https://, socks5://)')
        .default(DEFAULT_PAKE_OPTIONS.proxyUrl)
        .hideHelp())
        .addOption(new Option('--user-agent <string>', 'Custom user agent')
        .default(DEFAULT_PAKE_OPTIONS.userAgent)
        .hideHelp())
        .addOption(new Option('--targets <string>', 'Build target format for your system').default(DEFAULT_PAKE_OPTIONS.targets))
        .addOption(new Option('--app-version <string>', 'App version, the same as package.json version')
        .default(DEFAULT_PAKE_OPTIONS.appVersion)
        .hideHelp())
        .addOption(new Option('--always-on-top', 'Always on the top level')
        .default(DEFAULT_PAKE_OPTIONS.alwaysOnTop)
        .hideHelp())
        .addOption(new Option('--maximize', 'Start window maximized')
        .default(DEFAULT_PAKE_OPTIONS.maximize)
        .hideHelp())
        .addOption(new Option('--dark-mode', 'Force Mac app to use dark mode')
        .default(DEFAULT_PAKE_OPTIONS.darkMode)
        .hideHelp())
        .addOption(new Option('--disabled-web-shortcuts', 'Disabled webPage shortcuts')
        .default(DEFAULT_PAKE_OPTIONS.disabledWebShortcuts)
        .hideHelp())
        .addOption(new Option('--activation-shortcut <string>', 'Shortcut key to active App')
        .default(DEFAULT_PAKE_OPTIONS.activationShortcut)
        .hideHelp())
        .addOption(new Option('--show-system-tray', 'Show system tray in app')
        .default(DEFAULT_PAKE_OPTIONS.showSystemTray)
        .hideHelp())
        .addOption(new Option('--system-tray-icon <string>', 'Custom system tray icon')
        .default(DEFAULT_PAKE_OPTIONS.systemTrayIcon)
        .hideHelp())
        .addOption(new Option('--hide-on-close [boolean]', 'Hide window on close instead of exiting (default: true for macOS, false for others)')
        .default(DEFAULT_PAKE_OPTIONS.hideOnClose)
        .argParser((value) => {
        if (value === undefined)
            return true; // --hide-on-close without value
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        throw new Error('--hide-on-close must be true or false');
    })
        .hideHelp())
        .addOption(new Option('--title <string>', 'Window title').hideHelp())
        .addOption(new Option('--incognito', 'Launch app in incognito/private mode')
        .default(DEFAULT_PAKE_OPTIONS.incognito)
        .hideHelp())
        .addOption(new Option('--wasm', 'Enable WebAssembly support (Flutter Web, etc.)')
        .default(DEFAULT_PAKE_OPTIONS.wasm)
        .hideHelp())
        .addOption(new Option('--enable-drag-drop', 'Enable drag and drop functionality')
        .default(DEFAULT_PAKE_OPTIONS.enableDragDrop)
        .hideHelp())
        .addOption(new Option('--keep-binary', 'Keep raw binary file alongside installer')
        .default(DEFAULT_PAKE_OPTIONS.keepBinary)
        .hideHelp())
        .addOption(new Option('--multi-instance', 'Allow multiple app instances')
        .default(DEFAULT_PAKE_OPTIONS.multiInstance)
        .hideHelp())
        .addOption(new Option('--start-to-tray', 'Start app minimized to tray')
        .default(DEFAULT_PAKE_OPTIONS.startToTray)
        .hideHelp())
        .addOption(new Option('--force-internal-navigation', 'Keep every link inside the Pake window instead of opening external handlers')
        .default(DEFAULT_PAKE_OPTIONS.forceInternalNavigation)
        .hideHelp())
        .addOption(new Option('--installer-language <string>', 'Installer language')
        .default(DEFAULT_PAKE_OPTIONS.installerLanguage)
        .hideHelp())
        .addOption(new Option('--zoom <number>', 'Initial page zoom level (50-200)')
        .default(DEFAULT_PAKE_OPTIONS.zoom)
        .argParser((value) => {
        const zoom = parseInt(value);
        if (isNaN(zoom) || zoom < 50 || zoom > 200) {
            throw new Error('--zoom must be a number between 50 and 200');
        }
        return zoom;
    })
        .hideHelp())
        .addOption(new Option('--min-width <number>', 'Minimum window width')
        .default(DEFAULT_PAKE_OPTIONS.minWidth)
        .argParser(validateNumberInput)
        .hideHelp())
        .addOption(new Option('--min-height <number>', 'Minimum window height')
        .default(DEFAULT_PAKE_OPTIONS.minHeight)
        .argParser(validateNumberInput)
        .hideHelp())
        .addOption(new Option('--ignore-certificate-errors', 'Ignore certificate errors (for self-signed certificates)')
        .default(DEFAULT_PAKE_OPTIONS.ignoreCertificateErrors)
        .hideHelp())
        .addOption(new Option('--iterative-build', 'Turn on rapid build mode (app only, no dmg/deb/msi), good for debugging')
        .default(DEFAULT_PAKE_OPTIONS.iterativeBuild)
        .hideHelp())
        .addOption(new Option('--new-window', 'Allow new window for third-party login')
        .default(DEFAULT_PAKE_OPTIONS.newWindow)
        .hideHelp())
        .version(packageJson.version, '-v, --version')
        .configureHelp({
        sortSubcommands: true,
        optionTerm: (option) => {
            if (option.flags === '-v, --version' || option.flags === '-h, --help')
                return '';
            return option.flags;
        },
        optionDescription: (option) => {
            if (option.flags === '-v, --version' || option.flags === '-h, --help')
                return '';
            return option.description;
        },
    });
}

const program = getCliProgram();
async function checkUpdateTips() {
    updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify({
        isGlobal: true,
    });
}
program.action(async (url, options) => {
    await checkUpdateTips();
    if (!url) {
        program.help({
            error: false,
        });
        return;
    }
    log.setDefaultLevel('info');
    log.setLevel('info');
    if (options.debug) {
        log.setLevel('debug');
    }
    const appOptions = await handleOptions(options, url);
    const builder = BuilderProvider.create(appOptions);
    await builder.prepare();
    await builder.build(url);
});
program.parse();
