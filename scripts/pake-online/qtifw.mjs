#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const QTIFW_VERSION = "4.8.1";
export const QTIFW_INSTALLER_VERSION = "255.0.0";
export const QTIFW_DOWNLOADS = {
  windows: {
    file: "QtInstallerFramework-windows-x64-4.8.1.exe",
    sha256: "b0a7c6816dfaff7d571c9e5350fc08952f12022be87a28f6d8d36a78428c6210",
  },
  macos: {
    file: "QtInstallerFramework-macOS-x64-4.8.1.dmg",
    sha256: "f63b46c8e5b9c9fe5e42999bd94886cc827b0a951012b3c55d31c60576734bcd",
  },
  linux: {
    file: "QtInstallerFramework-linux-x64-4.8.1.run",
    sha256: "4b6f61a81b6560b27e40d5a25584685a8407642ac5430ba91e503f9b31986797",
  },
};

const DOWNLOAD_ROOT =
  "https://download.qt.io/official_releases/qt-installer-framework/4.8.1";

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileStem(value) {
  const stem = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "")
    .trim()
    .replace(/\s+/g, " ");
  return stem || "Pake Application";
}

function packageId(configId) {
  return `org.pake.online.${configId.replaceAll("-", ".")}`;
}

function repositoryBranch(configId) {
  return `pake-online-repository-${configId}`;
}

function stableGuid(value) {
  const bytes = crypto
    .createHash("sha256")
    .update(value)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex").toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

function packageVersion(appVersion, runNumber) {
  const numeric = String(appVersion)
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isSafeInteger(part) && part >= 0 ? part : 0));
  while (numeric.length < 3) numeric.push(0);
  const build = Number.parseInt(runNumber, 10);
  numeric.push(Number.isSafeInteger(build) && build > 0 ? build : 1);
  return numeric.join(".");
}

function platformLayout(config, sourcePath) {
  const appName = safeFileStem(config.cliConfig.name);
  if (config.os === "windows") {
    if (!fs.statSync(sourcePath).isFile()) {
      throw new Error("The Windows QtIFW payload must be an executable file.");
    }
    return {
      payloadName: "app.exe",
      targetDir: `@HomeDir@/AppData/Local/Pake/Apps/${config.id}`,
      runProgram: "@TargetDir@/app.exe",
      iconSource: path.resolve("src-tauri/png/icon_256.ico"),
      iconExtension: ".ico",
    };
  }
  if (config.os === "macos") {
    if (
      !fs.statSync(sourcePath).isDirectory() ||
      path.extname(sourcePath).toLowerCase() !== ".app"
    ) {
      throw new Error("The macOS QtIFW payload must be an application bundle.");
    }
    const payloadName = `${appName}.app`;
    return {
      payloadName,
      targetDir: `@HomeDir@/Library/Application Support/Pake/Apps/${config.id}`,
      runProgram: `@TargetDir@/${payloadName}`,
      iconSource: path.resolve("src-tauri/icons/icon.icns"),
      iconExtension: ".icns",
    };
  }
  if (config.os === "linux") {
    if (!fs.statSync(sourcePath).isFile()) {
      throw new Error("The Linux QtIFW payload must be an AppImage file.");
    }
    return {
      payloadName: `${appName}.AppImage`,
      targetDir: `@HomeDir@/.local/opt/${config.id}`,
      runProgram: `@TargetDir@/${appName}.AppImage`,
      iconSource: path.resolve("src-tauri/png/icon_512.png"),
      iconExtension: ".png",
    };
  }
  throw new Error(`Unsupported QtIFW platform: ${config.os}`);
}

function linuxLauncher(config, layout) {
  const packageName = packageId(config.id);
  const targetDirectory = `$HOME/.local/opt/${config.id}`;
  const target = `${targetDirectory}/${layout.payloadName}`;
  return `#!/bin/sh
backend="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/pake-online-backend"
maintenance="${targetDirectory}/pake-online-maintenance"
command=install
installer="$backend"
if [ -x "$maintenance" ]; then
  command=update
  installer="$maintenance"
fi
"$installer" \
  --accept-licenses \
  --default-answer \
  --confirm-command \
  "$command" ${packageName}
status=$?
if [ "$status" -ne 0 ]; then
  exit "$status"
fi
installed_app="${target}"
if [ ! -e "$installed_app" ]; then
  echo "The downloaded application was not installed at $installed_app." >&2
  exit 1
fi
exec "$installed_app" "$@"
`;
}

function macosLauncher(config, layout) {
  const relativeTargetDirectory = `Library/Application Support/Pake/Apps/${config.id}`;
  const relativeTarget = `${relativeTargetDirectory}/${layout.payloadName}`;
  return `import AppKit
import Darwin
import Foundation

func fail(_ message: String) -> Never {
    NSApplication.shared.setActivationPolicy(.accessory)
    NSApplication.shared.activate(ignoringOtherApps: true)
    let alert = NSAlert()
    alert.alertStyle = .critical
    alert.messageText = ${JSON.stringify(safeFileStem(config.cliConfig.name))}
    alert.informativeText = message
    alert.runModal()
    exit(1)
}

let backend = Bundle.main.bundleURL
    .appendingPathComponent("Contents/MacOS/pake-online-backend")
let targetDirectory = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(${JSON.stringify(relativeTargetDirectory)})
let maintenance = targetDirectory
    .appendingPathComponent("pake-online-maintenance.app/Contents/MacOS/pake-online-maintenance")
let hasExistingInstallation = FileManager.default.isExecutableFile(atPath: maintenance.path)
let process = Process()
process.executableURL = hasExistingInstallation ? maintenance : backend
process.arguments = [
    "--accept-licenses",
    "--default-answer",
    "--confirm-command",
    hasExistingInstallation ? "update" : "install",
    ${JSON.stringify(packageId(config.id))}
]

do {
    try process.run()
    process.waitUntilExit()
} catch {
    fail("Could not start the online installation backend: \\(error.localizedDescription)")
}

guard process.terminationStatus == 0 else {
    fail("The online installation failed with exit code \\(process.terminationStatus).")
}

let installedApplication = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(${JSON.stringify(relativeTarget)})
guard FileManager.default.fileExists(atPath: installedApplication.path) else {
    fail("The downloaded application could not be found.")
}
guard NSWorkspace.shared.open(installedApplication) else {
    fail("The downloaded application could not be opened.")
}
`;
}

function windowsLauncher(config) {
  const id = config.id.replaceAll("'", "''");
  const component = packageId(config.id).replaceAll("'", "''");
  return `$ErrorActionPreference = "Stop"
$targetDirectory = Join-Path $env:LOCALAPPDATA 'Pake\\Apps\\${id}'
$maintenance = Join-Path $targetDirectory 'pake-online-maintenance.exe'
$backend = Join-Path $PSScriptRoot 'pake-online-backend.exe'
$command = 'install'
$installer = $backend
if (Test-Path -LiteralPath $maintenance -PathType Leaf) {
    $command = 'update'
    $installer = $maintenance
}
& $installer \`
    '--accept-licenses' \`
    '--default-answer' \`
    '--confirm-command' \`
    $command \`
    '${component}'
exit $LASTEXITCODE
`;
}

function controllerScript(officialRepository, proxyRepository) {
  return `function Controller() {
    var curl = systemInfo.kernelType === "winnt" ? "curl.exe" : "curl";
    var result = installer.execute(curl, [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "4",
        "https://www.cloudflare.com/cdn-cgi/trace"
    ]);
    var trace = result.length > 0 ? String(result[0]) : "";
    var mainlandChina = /(^|\\n)loc=CN(\\r?\\n|$)/.test(trace);
    installer.setTemporaryRepositories([
        mainlandChina ? ${JSON.stringify(proxyRepository)} : ${JSON.stringify(officialRepository)}
    ], true);
}

Controller.prototype.IntroductionPageCallback = function() {
    var page = gui.currentPageWidget();
    if (page !== null) {
        page.title = "Install the latest verified build";
        page.MessageLabel.setText(
            "Experimental online mode downloads the newest successful build " +
            "when installation begins."
        );
        page.InformationLabel.setText(
            "The package is delivered by an open-source Qt Installer Framework repository."
        );
    }
};
`;
}

function componentScript(config, layout) {
  const appName = safeFileStem(config.cliConfig.name);
  if (config.os === "windows") {
    return `function Component() {}

Component.prototype.createOperations = function() {
    component.createOperations();
    component.addOperation(
        "CreateShortcut",
        "@TargetDir@/app.exe",
        "@StartMenuDir@/${appName}.lnk"
    );
    component.addOperation(
        "CreateShortcut",
        "@TargetDir@/app.exe",
        "@DesktopDir@/${appName}.lnk"
    );
};
`;
  }
  if (config.os === "linux") {
    return `function Component() {}

Component.prototype.createOperations = function() {
    component.createOperations();
    component.addOperation("Execute", "/bin/chmod", "+x", "${layout.runProgram}");
};
`;
  }
  return "function Component() {}\n";
}

function windowsWix(config) {
  const productName = safeFileStem(config.cliConfig.name);
  const realApplication = `[LocalAppDataFolder]Pake\\Apps\\${config.id}\\app.exe`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product
      Id="*"
      Name="${xml(productName)}"
      Language="1033"
      Version="${QTIFW_INSTALLER_VERSION}"
      Manufacturer="Pake"
      UpgradeCode="${stableGuid(`pake-online:${config.id}`)}">
    <Package InstallerVersion="450" Compressed="yes" InstallScope="perMachine" />
    <Property Id="REINSTALLMODE" Value="amus" />
    <MajorUpgrade AllowSameVersionUpgrades="yes" DowngradeErrorMessage="A newer version is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <Icon Id="ProductIcon" SourceFile="$(var.IconSource)" />
    <Property Id="ARPPRODUCTICON" Value="ProductIcon" />
    <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />
    <Property Id="WIXUI_EXITDIALOGOPTIONALCHECKBOXTEXT" Value="Launch ${xml(
      productName,
    )}" />
    <Property Id="WIXUI_EXITDIALOGOPTIONALCHECKBOX" Value="1" />
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="${xml(productName)}">
          <Directory Id="OnlineBackendFolder" Name=".pake-online" />
        </Directory>
      </Directory>
    </Directory>
    <DirectoryRef Id="OnlineBackendFolder">
      <Component Id="OnlineInstallerComponent" Guid="${stableGuid(
        `pake-online-component:${config.id}`,
      )}" Win64="yes">
        <File Id="OnlineInstaller" Name="pake-online-backend.exe" Source="$(var.QtIfwSource)" Checksum="yes" />
        <File Id="OnlineLauncher" Name="pake-online-launcher.ps1" Source="$(var.LauncherSource)" />
        <RegistryValue Root="HKCU" Key="Software\\Pake\\Online\\${xml(
          config.id,
        )}" Name="Installed" Type="integer" Value="1" KeyPath="yes" />
        <RemoveFolder Id="RemoveOnlineBackendFolder" Directory="OnlineBackendFolder" On="uninstall" />
      </Component>
    </DirectoryRef>
    <Feature Id="MainFeature" Title="${xml(productName)}" Level="1">
      <ComponentRef Id="OnlineInstallerComponent" />
    </Feature>
    <CustomAction
        Id="InstallOnlinePayload"
        Directory="INSTALLDIR"
        ExeCommand="powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File &quot;[#OnlineLauncher]&quot;"
        Execute="deferred"
        Return="check"
        Impersonate="yes" />
    <CustomAction
        Id="LaunchApplication"
        Directory="INSTALLDIR"
        ExeCommand="&quot;${xml(realApplication)}&quot;"
        Return="asyncNoWait"
        Impersonate="yes" />
    <InstallExecuteSequence>
      <Custom Action="InstallOnlinePayload" After="InstallFiles">NOT REMOVE</Custom>
    </InstallExecuteSequence>
    <UIRef Id="WixUI_InstallDir" />
    <UI>
      <Publish Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg" Order="2">1</Publish>
      <Publish Dialog="InstallDirDlg" Control="Back" Event="NewDialog" Value="WelcomeDlg" Order="2">1</Publish>
      <Publish Dialog="ExitDialog" Control="Finish" Event="DoAction" Value="LaunchApplication">
        WIXUI_EXITDIALOGOPTIONALCHECKBOX = 1 AND NOT Installed
      </Publish>
    </UI>
  </Product>
</Wix>
`;
}

function copyPayload(sourcePath, destinationPath) {
  fs.cpSync(sourcePath, destinationPath, {
    recursive: fs.statSync(sourcePath).isDirectory(),
    force: true,
    preserveTimestamps: false,
  });
  if (fs.statSync(destinationPath).isFile())
    fs.chmodSync(destinationPath, 0o755);
}

export function prepareQtIfwWorkspace(
  config,
  { sourcePath, outputDirectory, runNumber, iconPath },
) {
  const layout = platformLayout(config, sourcePath);
  const branch = repositoryBranch(config.id);
  const officialRepository = `https://github.com/${config.repository}/raw/${branch}/`;
  const proxyRepository = `https://v4.gh-proxy.org/${officialRepository}`;
  const root = path.resolve(outputDirectory);
  const configDirectory = path.join(root, "config");
  const componentDirectory = path.join(root, "packages", packageId(config.id));
  const dataDirectory = path.join(componentDirectory, "data");
  const metaDirectory = path.join(componentDirectory, "meta");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(metaDirectory, { recursive: true });

  const payloadPath = path.join(dataDirectory, layout.payloadName);
  copyPayload(path.resolve(sourcePath), payloadPath);

  const resolvedIcon = path.resolve(iconPath || layout.iconSource);
  if (!fs.existsSync(resolvedIcon)) {
    throw new Error(`QtIFW installer icon does not exist: ${resolvedIcon}`);
  }
  const iconTarget = path.join(
    configDirectory,
    `installer${layout.iconExtension}`,
  );
  fs.copyFileSync(resolvedIcon, iconTarget);

  const version = packageVersion(config.cliConfig.appVersion, runNumber);
  const appName = safeFileStem(config.cliConfig.name);
  const packageXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package>
  <DisplayName>${xml(appName)}</DisplayName>
  <Description>Latest verified ${xml(appName)} build from ${xml(
    config.sourceBranch,
  )}.</Description>
  <Version>${version}</Version>
  <ReleaseDate>${new Date().toISOString().slice(0, 10)}</ReleaseDate>
  <Default>true</Default>
  <ForcedInstallation>true</ForcedInstallation>
  <Script>installscript.qs</Script>
</Package>
`;
  fs.writeFileSync(path.join(metaDirectory, "package.xml"), packageXml);
  fs.writeFileSync(
    path.join(metaDirectory, "installscript.qs"),
    componentScript(config, layout),
  );
  fs.writeFileSync(
    path.join(configDirectory, "controller.qs"),
    controllerScript(officialRepository, proxyRepository),
  );

  let launcherPath = null;
  if (config.os === "windows") {
    launcherPath = path.join(root, "windows-launcher.ps1");
    fs.writeFileSync(launcherPath, windowsLauncher(config));
  } else if (config.os === "macos") {
    launcherPath = path.join(root, "macos-launcher.swift");
    fs.writeFileSync(launcherPath, macosLauncher(config, layout));
  } else if (config.os === "linux") {
    launcherPath = path.join(root, "linux-launcher.sh");
    fs.writeFileSync(launcherPath, linuxLauncher(config, layout), {
      mode: 0o755,
    });
  }

  const installerIcon = path
    .join(configDirectory, "installer")
    .replaceAll("\\", "/");
  const configXml = `<?xml version="1.0" encoding="UTF-8"?>
<Installer>
  <Name>${xml(appName)}</Name>
  <Version>${QTIFW_INSTALLER_VERSION}</Version>
  <Title>${xml(appName)}</Title>
  <Publisher>Pake</Publisher>
  <ProductUrl>https://github.com/${xml(config.repository)}</ProductUrl>
  <InstallerApplicationIcon>${xml(installerIcon)}</InstallerApplicationIcon>
  <StartMenuDir>${xml(appName)}</StartMenuDir>
  <TargetDir>${xml(layout.targetDir)}</TargetDir>
  <AdminTargetDir>${xml(layout.targetDir)}</AdminTargetDir>
  <MaintenanceToolName>pake-online-maintenance</MaintenanceToolName>
  <AllowNonAsciiCharacters>true</AllowNonAsciiCharacters>
  <WizardStyle>Modern</WizardStyle>
  <RepositorySettingsPageVisible>false</RepositorySettingsPageVisible>
  <ControlScript>controller.qs</ControlScript>
  <RunProgram>${xml(layout.runProgram)}</RunProgram>
  <RunProgramDescription>Launch ${xml(appName)}</RunProgramDescription>
  <RemoteRepositories>
    <Repository>
      <Url>${xml(officialRepository)}</Url>
    </Repository>
  </RemoteRepositories>
</Installer>
`;
  const configPath = path.join(configDirectory, "config.xml");
  fs.writeFileSync(configPath, configXml);

  let wixPath = null;
  if (config.os === "windows") {
    wixPath = path.join(root, "online-installer.wxs");
    fs.writeFileSync(wixPath, windowsWix(config));
  }

  const tool = QTIFW_DOWNLOADS[config.os];
  const result = {
    packageDirectory: path.join(root, "packages"),
    configPath,
    controllerPath: path.join(configDirectory, "controller.qs"),
    iconPath: iconTarget,
    repositoryDirectory: path.join(root, "repository"),
    repositoryBranch: branch,
    officialRepository,
    proxyRepository,
    packageId: packageId(config.id),
    packageVersion: version,
    payloadName: layout.payloadName,
    appName,
    runProgram: layout.runProgram,
    launcherPath,
    wixPath,
    qtifwDownloadUrl: `${DOWNLOAD_ROOT}/${tool.file}`,
    qtifwDownloadSha256: tool.sha256,
  };
  fs.writeFileSync(
    path.join(root, "workspace.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}

function appendGithubOutput(result) {
  const values = Object.fromEntries(
    Object.entries(result)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        value,
      ]),
  );
  if (!process.env.GITHUB_OUTPUT) {
    process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
    return;
  }
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
}

function runCli() {
  const [
    command,
    configPath,
    sourcePath,
    outputDirectory,
    runNumber,
    iconPath,
  ] = process.argv.slice(2);
  if (command !== "prepare" || !configPath || !sourcePath || !outputDirectory) {
    throw new Error(
      "Usage: qtifw.mjs prepare <config> <payload> <output> [run-number] [icon]",
    );
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  appendGithubOutput(
    prepareQtIfwWorkspace(config, {
      sourcePath,
      outputDirectory,
      runNumber,
      iconPath,
    }),
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
