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
offline wrapper and experimental online installer. ICO files are used
directly; SVG, PNG, JPEG, and other Sharp-supported images are converted to
ICO. Icon URLs must use HTTP(S), cannot contain credentials, and are limited to
10 MiB.

## Experimental Online Mode

Select `online_mode` when running `Build App With Pake CLI` to register the
current form values for the selected branch. The first run builds immediately;
each later push to that same branch rebuilds every registered configuration and
updates its rolling prerelease.

For every online-mode build, the regular offline package version is
automatically set to the latest stable Pake Release version. In a fork, the
workflow reads the latest Release from its upstream parent repository. The
manual `app_version` value continues to apply to non-online builds.

The prerelease contains both the regular offline package and a lightweight
online installer:

- Windows: `.exe`, which downloads and launches the verified MSI
- macOS: `.dmg` containing an installer app, which installs the verified app
  into `/Applications`
- Linux: `.AppImage`, which selects a native DEB/RPM/ZST when available and
  falls back to a user-level AppImage installation

The online installer resolves only completed manifests, verifies file size and
SHA-256, then displays the real installer output. In mainland China, verified
GitHub asset downloads automatically try `v4.gh-proxy.org` first and fall back
to GitHub. For example,
`https://github.com/owner/repo/releases/download/...` becomes
`https://v4.gh-proxy.org/https://github.com/owner/repo/releases/download/...`;
the result must still pass the manifest size and SHA-256 checks.

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
- Saved configurations live on the workflow-managed `pake-online-config`
  branch. Each configuration consumes a runner on every matching push.
- Windows and Linux may request elevation through the native installer or
  `pkexec`; macOS requests administrator authorization when replacing an app in
  `/Applications`.

## Tips

- Be patient on first run - let cache build completely
- Stable network connection recommended
- If build fails, delete cache and retry

## Links

- [CLI Documentation](cli-usage.md)
- [Advanced Usage](advanced-usage.md)
