import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyOnlineReleaseVersion,
  createBuildConfig,
  createConfigId,
  createMatrix,
  loadRegistryConfigs,
  normalizeReleaseVersion,
  pauseRegistryConfig,
  upsertRegistryConfig,
} from "../../scripts/pake-online/config.mjs";
import {
  isIco,
  normalizeIconUrl,
  writeWindowsIcon,
} from "../../scripts/pake-online/icon.mjs";
import {
  detectArtifactFormat,
  selectReleaseAssetsToDelete,
  stageReleaseAssets,
} from "../../scripts/pake-online/release.mjs";
import {
  prepareQtIfwWorkspace,
  QTIFW_DOWNLOADS,
  QTIFW_INSTALLER_VERSION,
} from "../../scripts/pake-online/qtifw.mjs";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pake-online-"));
  temporaryDirectories.push(directory);
  return directory;
}

function sampleInputs(overrides = {}) {
  return {
    platform: "windows-latest",
    url: "https://example.com",
    name: "Example App",
    icon: "",
    width: "1200",
    height: "780",
    min_width: "",
    min_height: "",
    app_version: "1.2.3",
    fullscreen: false,
    hide_title_bar: false,
    multi_arch: false,
    targets: "deb",
    online_mode: true,
    online_operation: "enable-or-update",
    online_windows_format: "msi",
    offline_exe: false,
    offline_exe_icon: "",
    online_exe_icon: "",
    ...overrides,
  };
}

function sampleContext(overrides = {}) {
  return {
    repository: "owner/repo",
    sourceBranch: "main",
    runId: "42",
    now: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Pake online build configuration", () => {
  it("creates a stable id from repository, branch, platform, and app name", () => {
    const value = {
      repository: "owner/repo",
      sourceBranch: "main",
      platform: "windows-latest",
      name: "Example App",
    };
    expect(createConfigId(value)).toBe(createConfigId(value));
    expect(createConfigId(value)).toMatch(/^example-app-windows-[a-f0-9]{10}$/);
    expect(createConfigId({ ...value, sourceBranch: "release" })).not.toBe(
      createConfigId(value),
    );
  });

  it("normalizes workflow inputs into an explicit CLI config", () => {
    const config = createBuildConfig(
      sampleInputs({
        min_width: "640",
        fullscreen: true,
        targets: "deb,appimage",
      }),
      sampleContext(),
    );

    expect(config.online).toBe(true);
    expect(config.releaseTag).toBe(`pake-online-${config.id}`);
    expect(config.delivery).toEqual({
      windowsOfflineExe: false,
      onlineWindowsFormat: "msi",
      offlineExeIcon: null,
      onlineExeIcon: null,
    });
    expect(config.cliConfig).toEqual({
      url: "https://example.com",
      name: "Example App",
      icon: "",
      width: 1200,
      height: 780,
      minWidth: 640,
      minHeight: 0,
      appVersion: "1.2.3",
      targets: "msi",
      fullscreen: true,
      hideTitleBar: false,
      multiArch: false,
    });
  });

  it("uses the latest Release version for online runtime builds", () => {
    const config = createBuildConfig(sampleInputs(), sampleContext());
    const runtimeConfig = applyOnlineReleaseVersion(config, "V3.15.1");

    expect(runtimeConfig.cliConfig.appVersion).toBe("3.15.1");
    expect(config.cliConfig.appVersion).toBe("1.2.3");
    expect(normalizeReleaseVersion("v4.0.0-beta.1")).toBe("4.0.0-beta.1");
    expect(() => normalizeReleaseVersion("latest")).toThrow(/semantic version/);
  });

  it("uses AppImage as the portable Linux QtIFW component", () => {
    const config = createBuildConfig(
      sampleInputs({
        platform: "ubuntu-24.04",
        targets: "deb,rpm",
      }),
      sampleContext(),
    );
    const runtimeConfig = applyOnlineReleaseVersion(config, "V3.15.1");
    expect(runtimeConfig.cliConfig.targets).toBe("appimage");
  });

  it("keeps the requested version for non-online builds", () => {
    const config = createBuildConfig(
      sampleInputs({ online_mode: false }),
      sampleContext(),
    );
    expect(applyOnlineReleaseVersion(config)).toBe(config);
    expect(config.cliConfig.appVersion).toBe("1.2.3");
  });

  it("keeps Linux targets and rejects non-web URLs", () => {
    const linux = createBuildConfig(
      sampleInputs({
        platform: "ubuntu-24.04",
        targets: "deb,appimage,rpm",
      }),
      sampleContext(),
    );
    expect(linux.cliConfig.targets).toBe("deb,appimage,rpm");
    expect(() =>
      createBuildConfig(
        sampleInputs({ url: "file:///tmp/app.html" }),
        sampleContext(),
      ),
    ).toThrow(/http or https/);
  });

  it("stores independent online and offline Windows EXE icon URLs", () => {
    const config = createBuildConfig(
      sampleInputs({
        offline_exe: true,
        online_windows_format: "exe",
        offline_exe_icon: "https://example.com/offline.ico",
        online_exe_icon: "https://example.com/online.png",
      }),
      sampleContext(),
    );
    expect(config.delivery).toEqual({
      windowsOfflineExe: true,
      onlineWindowsFormat: "exe",
      offlineExeIcon: "https://example.com/offline.ico",
      onlineExeIcon: "https://example.com/online.png",
    });
  });

  it("rejects unsupported Windows online installer formats", () => {
    expect(() =>
      createBuildConfig(
        sampleInputs({ online_windows_format: "nsis" }),
        sampleContext(),
      ),
    ).toThrow(/Windows installer format/);
  });

  it("preserves createdAt on update and filters configs by source branch", () => {
    const directory = temporaryDirectory();
    const initial = createBuildConfig(sampleInputs(), sampleContext());
    upsertRegistryConfig(directory, initial);
    upsertRegistryConfig(directory, {
      ...initial,
      updatedAt: "2026-07-24T00:00:00.000Z",
      createdAt: "changed",
    });
    upsertRegistryConfig(
      directory,
      createBuildConfig(
        sampleInputs({ name: "Release App" }),
        sampleContext({ sourceBranch: "release" }),
      ),
    );

    const configs = loadRegistryConfigs(directory, "main");
    expect(configs).toHaveLength(1);
    expect(configs[0].createdAt).toBe("2026-07-23T00:00:00.000Z");
    expect(createMatrix(configs).include[0].config.id).toBe(initial.id);
  });

  it("pauses a config without affecting other registry entries", () => {
    const directory = temporaryDirectory();
    const first = createBuildConfig(sampleInputs(), sampleContext());
    const second = createBuildConfig(
      sampleInputs({ name: "Other" }),
      sampleContext(),
    );
    upsertRegistryConfig(directory, first);
    upsertRegistryConfig(directory, second);

    expect(pauseRegistryConfig(directory, first.id)).toBe(true);
    expect(pauseRegistryConfig(directory, first.id)).toBe(false);
    expect(loadRegistryConfigs(directory, "main").map(({ id }) => id)).toEqual([
      second.id,
    ]);
  });

  it("emits an empty matrix when a pushed branch has no registrations", () => {
    expect(createMatrix([])).toEqual({ include: [] });
    expect(loadRegistryConfigs(temporaryDirectory(), "unregistered")).toEqual(
      [],
    );
  });
});

describe("Qt Installer Framework online packaging", () => {
  function onlineConfig(osName) {
    return {
      id: `example-${osName}-123`,
      repository: "owner/repo",
      sourceBranch: "main",
      os: osName,
      cliConfig: {
        name: "Example App",
        appVersion: "3.15.1",
      },
    };
  }

  it("generates a Windows QtIFW repository and native MSI definition", () => {
    const directory = temporaryDirectory();
    const source = path.join(directory, "source.exe");
    fs.writeFileSync(source, "windows executable");

    const result = prepareQtIfwWorkspace(onlineConfig("windows"), {
      sourcePath: source,
      outputDirectory: path.join(directory, "workspace"),
      runNumber: "42",
    });

    expect(result.packageVersion).toBe("3.15.1.42");
    expect(result.repositoryBranch).toBe(
      "pake-online-repository-example-windows-123",
    );
    expect(result.proxyRepository).toBe(
      `https://v4.gh-proxy.org/${result.officialRepository}`,
    );
    expect(fs.existsSync(result.wixPath)).toBe(true);
    expect(
      fs.existsSync(
        path.join(result.packageDirectory, result.packageId, "data", "app.exe"),
      ),
    ).toBe(true);
    expect(fs.readFileSync(result.configPath, "utf8")).toContain(
      `<Version>${QTIFW_INSTALLER_VERSION}</Version>`,
    );
    expect(fs.readFileSync(result.controllerPath, "utf8")).toContain(
      "installer.setTemporaryRepositories",
    );
    const wix = fs.readFileSync(result.wixPath, "utf8");
    expect(wix).toContain('Name="Example App"');
    expect(wix).not.toContain('Name="Example App Online"');
    expect(wix).toContain('Id="InstallOnlinePayload"');
    expect(wix).toContain('Execute="deferred"');
    expect(wix).toContain("pake-online-launcher.ps1");
    expect(wix).not.toContain('Id="LaunchOnlineInstaller"');
    expect(wix).toContain(
      '<Publish Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg"',
    );
    const launcher = fs.readFileSync(result.launcherPath, "utf8");
    expect(launcher).toContain("pake-online-maintenance.exe");
    expect(launcher).toContain("$command = 'update'");
    expect(launcher).toContain("org.pake.online.example.windows.123");
  });

  it.each([
    ["macos", "Example Source.app", "Example App.app"],
    ["linux", "Example.AppImage", "Example App.AppImage"],
  ])(
    "uses the same QtIFW 7z repository model for %s",
    (osName, sourceName, payloadName) => {
      const directory = temporaryDirectory();
      const source = path.join(directory, sourceName);
      if (osName === "macos") {
        fs.mkdirSync(source);
        fs.writeFileSync(path.join(source, "Info.plist"), "plist");
      } else {
        fs.writeFileSync(source, "appimage");
      }

      const result = prepareQtIfwWorkspace(onlineConfig(osName), {
        sourcePath: source,
        outputDirectory: path.join(directory, "workspace"),
        runNumber: "7",
      });

      expect(
        fs.existsSync(
          path.join(
            result.packageDirectory,
            result.packageId,
            "data",
            payloadName,
          ),
        ),
      ).toBe(true);
      expect(result.wixPath).toBeNull();
      expect(fs.existsSync(result.launcherPath)).toBe(true);
      const launcher = fs.readFileSync(result.launcherPath, "utf8");
      expect(launcher).toContain("pake-online-backend");
      expect(launcher).toContain(
        "org.pake.online.example." +
          (osName === "macos" ? "macos" : "linux") +
          ".123",
      );
      expect(launcher).not.toContain("binarycreator");
      expect(launcher).toContain("update");
      expect(launcher).toContain("pake-online-maintenance");
      if (osName === "macos") {
        expect(path.extname(result.launcherPath)).toBe(".swift");
        expect(launcher).toContain("NSWorkspace.shared.open");
      } else {
        expect(path.extname(result.launcherPath)).toBe(".sh");
        expect(launcher).toContain('exec "$installed_app" "$@"');
      }
      expect(result.qtifwDownloadSha256).toBe(QTIFW_DOWNLOADS[osName].sha256);
    },
  );

  it("keeps the QtIFW wizard hidden behind native-looking carriers", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pake-cli.yaml"),
      "utf8",
    );
    expect(workflow).toContain("src-tauri/assets/macos/dmg/background.png");
    expect(workflow).toContain("--no-internet-enable");
    expect(workflow).toContain('hdiutil verify "$online_dmg"');
    expect(workflow).toContain('--icon "$ONLINE_APP_NAME.app" 190 250');
    expect(workflow).toContain("--app-drop-link 500 250");
    expect(workflow).toContain("Name=$ONLINE_APP_NAME");
    expect(workflow).toContain(
      'swiftc "${{ steps.qtifw.outputs.launcher_path }}"',
    );
    expect(workflow).toContain(
      'cp "${{ steps.qtifw.outputs.launcher_path }}" "$appdir/AppRun"',
    );
    expect(workflow).not.toContain(
      'exec "$APPDIR/usr/bin/pake-online-installer"',
    );
  });
});

describe("Pake online release assets", () => {
  it("detects every supported offline installer format", () => {
    expect(detectArtifactFormat("App.msi")).toBe("msi");
    expect(detectArtifactFormat("App.exe")).toBe("exe");
    expect(detectArtifactFormat("App.dmg")).toBe("dmg");
    expect(detectArtifactFormat("App.deb")).toBe("deb");
    expect(detectArtifactFormat("App.rpm")).toBe("rpm");
    expect(detectArtifactFormat("App.AppImage")).toBe("appimage");
    expect(detectArtifactFormat("App-1.pkg.tar.zst")).toBe("zst");
    expect(detectArtifactFormat("App.tar.zst")).toBe("tar.zst");
    expect(detectArtifactFormat("App.7z")).toBe("7z");
  });

  it("stages versioned assets and writes a checksummed manifest", () => {
    const root = temporaryDirectory();
    const input = path.join(root, "input");
    const output = path.join(root, "output");
    fs.mkdirSync(input);
    const payloadPath = path.join(input, "Example App.tar.zst");
    fs.writeFileSync(payloadPath, "compressed-payload");
    fs.writeFileSync(
      `${payloadPath}.json`,
      JSON.stringify({
        format: "tar.zst",
        expandedSize: 42,
        executableName: "app.exe",
        executableSha256: "a".repeat(64),
      }),
    );
    const config = createBuildConfig(sampleInputs(), sampleContext());
    const result = stageReleaseAssets(config, {
      inputDirectory: input,
      outputDirectory: output,
      sourceSha: "1234567890abcdef",
      runAttempt: "2",
      arch: "X64",
      builtAt: "2026-07-23T00:00:00.000Z",
    });

    expect(result.manifest.artifacts).toHaveLength(1);
    const payload = result.manifest.artifacts.find(
      (artifact) => artifact.format === "tar.zst",
    );
    expect(payload).toMatchObject({
      format: "tar.zst",
      size: 18,
      name: `${config.id}-1234567890ab.tar.zst`,
      packageId: config.id,
      expandedSize: 42,
      executableName: "app.exe",
      executableSha256: "a".repeat(64),
    });
    expect(payload.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifest.onlineInstaller.name).toBe(
      `${config.id}-online-installer.msi`,
    );
    expect(path.basename(result.manifestPath)).toBe(
      "pake-online-manifest-1234567890ab-2.json",
    );
  });

  it("names the Windows online carrier from the configured format", () => {
    const root = temporaryDirectory();
    const input = path.join(root, "input");
    const output = path.join(root, "output");
    fs.mkdirSync(input);
    const payloadPath = path.join(input, "payload.tar.zst");
    fs.writeFileSync(payloadPath, "payload");
    fs.writeFileSync(
      `${payloadPath}.json`,
      JSON.stringify({
        format: "tar.zst",
        expandedSize: 7,
        executableName: "app.exe",
        executableSha256: "b".repeat(64),
      }),
    );
    const config = createBuildConfig(
      sampleInputs({ online_windows_format: "exe" }),
      sampleContext(),
    );
    const result = stageReleaseAssets(config, {
      inputDirectory: input,
      outputDirectory: output,
      sourceSha: "1234567890abcdef",
      arch: "X64",
    });
    expect(result.manifest.onlineInstaller.name).toBe(
      `${config.id}-online-installer.exe`,
    );
  });

  it("keeps the latest two manifests and their referenced packages", () => {
    const assets = [
      { id: 9, name: "pake-online-manifest-new.json" },
      { id: 8, name: "pake-online-manifest-previous.json" },
      { id: 7, name: "pake-online-manifest-old.json" },
      { id: 6, name: "example-windows-id-new.tar.zst" },
      { id: 5, name: "example-windows-id-previous.tar.zst" },
      { id: 4, name: "example-windows-id-old.tar.zst" },
      { id: 3, name: "example-windows-id-online-installer.msi" },
      { id: 2, name: "maintainer-notes.txt" },
    ];
    const manifests = new Map([
      [
        "pake-online-manifest-new.json",
        {
          artifacts: [{ name: "example-windows-id-new.tar.zst" }],
          onlineInstaller: {
            name: "example-windows-id-online-installer.msi",
          },
        },
      ],
      [
        "pake-online-manifest-previous.json",
        {
          artifacts: [{ name: "example-windows-id-previous.tar.zst" }],
          onlineInstaller: {
            name: "example-windows-id-online-installer.msi",
          },
        },
      ],
    ]);

    expect(
      selectReleaseAssetsToDelete(assets, manifests, "example-windows-id").map(
        ({ name }) => name,
      ),
    ).toEqual([
      "pake-online-manifest-old.json",
      "example-windows-id-old.tar.zst",
    ]);
  });
});

describe("Windows installer icon preparation", () => {
  it("accepts web URLs without embedded credentials", () => {
    expect(normalizeIconUrl("https://example.com/icon.png")).toBe(
      "https://example.com/icon.png",
    );
    expect(() => normalizeIconUrl("file:///tmp/icon.ico")).toThrow(/HTTP/);
    expect(() =>
      normalizeIconUrl("https://token@example.com/icon.ico"),
    ).toThrow(/credentials/);
  });

  it("preserves an ICO payload for the requested installer", async () => {
    const directory = temporaryDirectory();
    const output = path.join(directory, "installer.ico");
    const ico = Buffer.from([0, 0, 1, 0, 0, 0]);
    expect(isIco(ico)).toBe(true);
    await writeWindowsIcon(ico, output);
    expect(fs.readFileSync(output)).toEqual(ico);
  });

  it("converts a PNG into a multi-size Windows ICO", async () => {
    const directory = temporaryDirectory();
    const output = path.join(directory, "converted.ico");
    const png = fs.readFileSync(
      path.join(process.cwd(), "src-tauri/png/icon_512.png"),
    );
    await writeWindowsIcon(png, output);
    expect(isIco(fs.readFileSync(output))).toBe(true);
  });
});

describe("Build App With Pake CLI online workflow", () => {
  it("registers push builds while preserving manual dispatch", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pake-cli.yaml"),
      "utf8",
    );
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("online_mode:");
    expect(workflow).toContain("online_operation:");
    expect(workflow).toContain("online_windows_format:");
    expect(workflow).toContain("offline_exe:");
    expect(workflow).toContain("offline_exe_icon:");
    expect(workflow).toContain("online_exe_icon:");
    expect(workflow).toContain('ONLINE_CONFIG_BRANCH: "pake-online-config"');
    expect(workflow).toContain('node dist/cli.js --config "$PAKE_CLI_CONFIG"');
    expect(workflow).toContain(
      'node dist/cli.js --config "$env:PAKE_CLI_CONFIG"',
    );
    expect(workflow).toContain("Install Qt Installer Framework");
    expect(workflow).toContain("scripts/pake-online/qtifw.mjs");
    expect(workflow).toContain("--remove --ac 9");
    expect(workflow).toContain("<DownloadableArchives>");
    expect(workflow).toContain('-name "*$archive_suffix"');
    expect(workflow).toContain('test "$count" -eq 1');
    expect(workflow).not.toContain("$archive_name");
    expect(workflow).toContain("Clear stale Windows online entrypoints");
    expect(workflow).toContain('if ($env:ONLINE_WINDOWS_FORMAT -eq "exe")');
    expect(workflow).toContain("candle.exe");
    expect(workflow).toContain("binarycreator");
    expect(workflow).toContain("Publish QtIFW repository branch");
    expect(workflow).toContain("pake-online-repository-worktree");
    expect(workflow).toContain("appimagetool");
    expect(workflow).toContain("Build offline EXE wrapper (Windows)");
    expect(workflow).toContain("PAKE_OFFLINE_ICON");
    expect(workflow).toContain("ONLINE_EXE_ICON");
    expect(workflow).toContain(
      'gh api "repos/$RELEASE_REPOSITORY/releases/latest"',
    );
    expect(workflow).toContain("node scripts/pake-online/config.mjs runtime");
    expect(workflow).toContain(
      'git -C "$REGISTRY_WORKTREE" rm -rf --ignore-unmatch .',
    );
  });

  it("publishes the real package and online carrier before the manifest", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pake-cli.yaml"),
      "utf8",
    );
    const actualUpload = workflow.indexOf(
      "for asset in .pake-online-release/actual/*",
    );
    const onlineUpload = workflow.indexOf(
      "for asset in .pake-online-release/online/*",
    );
    const manifestUpload = workflow.indexOf(
      "for manifest in .pake-online-release/manifest/*",
    );
    expect(actualUpload).toBeGreaterThan(0);
    expect(onlineUpload).toBeGreaterThan(actualUpload);
    expect(manifestUpload).toBeGreaterThan(onlineUpload);
  });

  it("uploads only the online carrier as an Actions artifact in online mode", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pake-cli.yaml"),
      "utf8",
    );
    expect(workflow).toContain(
      "if: runner.os == 'Windows' && !matrix.config.online",
    );
    expect(workflow).toContain(
      "if: runner.os == 'macOS' && !matrix.config.online",
    );
    expect(workflow).toContain(
      "if: runner.os == 'Linux' && !matrix.config.online",
    );
    expect(workflow).toContain("- name: Upload online installer");
    expect(workflow).toContain(
      "name: ${{ matrix.config.cliConfig.name }}-${{ matrix.config.os }}-online-installer",
    );
    expect(workflow).toContain('path: ".pake-online-release/online/*"');
  });

  it("builds every online installer carrier in full CI", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/quality-and-test.yml"),
      "utf8",
    );
    expect(workflow).toContain("online-installer-build:");
    expect(workflow).toContain("scripts/pake-online/install-qtifw.sh");
    expect(workflow).toContain("qtifw.mjs prepare");
    expect(workflow).toContain("repogen");
    expect(workflow).toContain("binarycreator");
    expect(workflow).toContain('-name "*$archive_suffix"');
    expect(workflow).toContain('test "$count" -eq 1');
    expect(
      fs.readFileSync(
        path.join(process.cwd(), "scripts/pake-online/install-qtifw.sh"),
        "utf8",
      ),
    ).toContain("libxkbcommon-x11-0");
  });
});
