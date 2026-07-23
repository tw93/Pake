# GitHub Actions 使用指南

<h4 align="right"><strong><a href="github-actions-usage.md">English</a></strong> | 简体中文</h4>

无需本地安装开发工具，在线构建 Pake 应用。

## 快速步骤

### 1. Fork 仓库

[Fork 此项目](https://github.com/tw93/Pake/fork)

### 2. 运行工作流

1. 前往你 Fork 的仓库的 Actions 页面
2. 选择 `Build App With Pake CLI`
3. 填写表单（参数与 [CLI 选项](cli-usage_CN.md) 相同）
4. 点击 `Run Workflow`

   ![Actions 界面](https://raw.githubusercontent.com/tw93/static/main/pake/action.png)

### 3. 下载应用

- 绿色勾号 = 构建成功
- 点击工作流名称查看详情
- 在 `Artifacts` 部分下载应用

  ![构建成功](https://raw.githubusercontent.com/tw93/static/main/pake/action2.png)

### 4. 构建时间

- **首次运行**：约 10-15 分钟（建立缓存）
- **后续运行**：约 5 分钟（使用缓存）
- 缓存大小：完成时为 400-600MB

### 可选的 Windows 离线 EXE

勾选 `offline_exe` 会额外发布一个 `.exe`。它内嵌本次生成的 MSI，并使用原生
Windows Installer 界面执行安装；原本的 MSI 离线包仍会保留。

`offline_exe_icon` 与 `online_exe_icon` 可分别设置离线 EXE 包装器和实验性在线
安装器的图标 URL。ICO 会直接使用；SVG、PNG、JPEG 以及其他 Sharp 支持的图片
会自动转换成 ICO。图标 URL 必须使用 HTTP(S)、不得包含凭据，大小上限为 10 MiB。

## 实验性在线模式

运行 `Build App With Pake CLI` 时勾选 `online_mode`，即可为当前分支登记本次
表单配置。首次运行会立即构建；以后每次向同一分支 push，都会重新构建该分支
登记的全部配置，并更新各自的滚动预发布。

预发布会同时提供常规离线包和轻量在线安装器：

- Windows：`.exe`，下载并启动通过校验的 MSI
- macOS：包含安装器应用的 `.dmg`，将通过校验的应用安装到 `/Applications`
- Linux：`.AppImage`，优先选择匹配发行版的 DEB/RPM/ZST，否则执行用户级
  AppImage 安装

在线安装器只解析已经完成发布的 manifest，校验文件大小和 SHA-256，然后实时
显示真正安装程序的输出。在中国大陆，会优先通过 `v4.gh-proxy.org` 下载已经
验证的 GitHub 资产，失败时回退 GitHub 官方地址。例如，
`https://github.com/owner/repo/releases/download/...` 会改写为
`https://v4.gh-proxy.org/https://github.com/owner/repo/releases/download/...`；
下载结果仍必须通过 manifest 中的大小和 SHA-256 校验。

### 前置条件与限制

- 在线模式为实验性功能，仅支持公开 Fork；配置和安装器绝不会保存 GitHub
  token。
- 在 **Settings → Actions → General → Workflow permissions** 中允许工作流
  读写仓库，以便维护配置分支和预发布。
- 配置按“应用名、平台、源码分支”区分；对同一组合再次选择
  `enable-or-update` 会更新已保存配置。
- 在同一应用、平台和分支下选择 `pause` 可停止后续 push 自动构建；最后一次
  预发布仍然保留。
- 配置保存在工作流管理的 `pake-online-config` 分支。每套配置都会在匹配分支
  的每次 push 中占用一个 runner。
- Windows 和 Linux 可能分别通过原生安装程序或 `pkexec` 请求提权；macOS
  替换 `/Applications` 中的应用时会请求管理员授权。

## 提示

- 首次运行需要耐心等待，让缓存完全建立
- 建议网络连接稳定
- 如果构建失败，删除缓存后重试

## 链接

- [CLI 文档](cli-usage_CN.md)
- [高级用法](advanced-usage_CN.md)
