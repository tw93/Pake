# GitHub Actions Usage Guide

<h4 align="right"><strong>English</strong> | <a href="github-actions-usage_CN.md">简体中文</a></h4>

Build Pake apps online without installing development tools locally.

## Quick Steps

### 1. Fork Repository

[Fork this project](https://github.com/tw93/Pake/fork)

### 2. Run Workflow

1. Go to Actions tab in your forked repository
2. Select `Build App With Pake CLI`
3. Fill in the form (same parameters as [CLI options](cli-usage.md))
4. Click `Run Workflow`

   ![Actions Interface](https://raw.githubusercontent.com/tw93/static/main/pake/action.png)

### 3. Download App

- Green checkmark = build success
- Click the workflow name to view details
- Find `Artifacts` section and download your app

  ![Build Success](https://raw.githubusercontent.com/tw93/static/main/pake/action2.png)

### 4. Build Times

- **First run**: ~10-15 minutes (sets up cache)
- **Subsequent runs**: ~5 minutes (uses cache)
- Cache size: 400-600MB when complete

### Optional Windows Offline EXE

Select `offline_exe` to publish an additional `.exe` that embeds the generated
MSI and launches Windows Installer with its native UI. The MSI remains
available as the regular offline package.

`offline_exe_icon` and `online_exe_icon` are independent icon URLs for the
offline wrapper and experimental Windows online installer. ICO files are used
directly; SVG, PNG, JPEG, and other Sharp-supported images are converted to
ICO. Icon URLs must use HTTP(S), cannot contain credentials, and are limited to
10 MiB.

## Experimental Online Mode

Select `online_mode` when running `Build App With Pake CLI` to register the
current form values for the selected branch. The first run builds immediately;
each later push to that same branch rebuilds every registered configuration and
updates its rolling prerelease.

For every online-mode build, the application version is automatically set to
the latest stable Pake Release version. In a fork, the workflow reads the
latest Release from its upstream parent repository. The manual `app_version`
value continues to apply to non-online builds.

The prerelease contains the versioned Qt Installer Framework component archive
plus an online installer. Pake uses the open-source Qt Installer Framework
(QtIFW) rather than a custom webview application. Its standard introduction,
target directory, download, progress, and completion pages keep the native look
and feel of each platform and remain customizable through checked-in controller
and component scripts.

- Windows: `online_windows_format` selects an app-specific `.msi` or `.exe`.
  The MSI installs and opens the QtIFW online wizard. The EXE is a completely
  windowless wrapper around that same MSI; `online_exe_icon` controls both the
  wrapper and installer icon. The carrier uses version `255.0.0`, while the
  downloaded application keeps the latest stable Pake Release version.
- macOS: `.dmg` containing a native QtIFW installer `.app`, which downloads the
  latest application bundle and installs it into `/Applications`.
- Linux: `.AppImage` containing the QtIFW installer, which downloads the latest
  application AppImage and creates the normal user-level installation.

For online-mode runs, the Actions **Artifacts** section contains only the
online installer. Open the rolling prerelease when you also need the real
payload or native package. Non-online runs continue to upload only their
regular offline packages as three-day Actions artifacts.

All three platforms use the same maximum-compression QtIFW 7z repository
format. Each configuration has an isolated
`pake-online-repository-<config-id>` branch, updated only after its application
and online carrier build successfully. QtIFW verifies repository metadata and
archive hashes and shows download progress directly in its installation page.
The rolling Release continues to retain the current and previous successful
component archives and manifests.

Before QtIFW fetches repository metadata, the checked-in controller script
queries Cloudflare's country trace. In mainland China it changes
`https://github.com/owner/repo/raw/...` to
`https://v4.gh-proxy.org/https://github.com/owner/repo/raw/...`; elsewhere it
uses GitHub directly.

### Requirements and Limits

- Online mode is experimental and supports public forks only. No GitHub token
  is stored in the configuration or installer.
- In **Settings → Actions → General → Workflow permissions**, allow read and
  write access so the workflow can maintain its configuration branch and
  prereleases.
- Configurations are keyed by app name, platform, and source branch. Running
  the same combination with `enable-or-update` replaces its saved values.
- Select `pause` with the same app, platform, and branch to stop future push
  builds. The last prerelease remains available.
- Saved configurations live on `pake-online-config`; generated QtIFW
  repositories use isolated `pake-online-repository-<config-id>` branches.
  Each configuration consumes a runner on every matching push.
- The Windows application is installed per-user. macOS may request
  administrator authorization for `/Applications`; Linux uses a user-level
  target by default.

## Tips

- Be patient on first run - let cache build completely
- Stable network connection recommended
- If build fails, delete cache and retry

## Links

- [CLI Documentation](cli-usage.md)
- [Advanced Usage](advanced-usage.md)
