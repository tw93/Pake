# 快速上手

<div align="center">

[English](getting-started.md) · **中文**

</div>

这篇教程从一个空的终端开始，一步步做出一个能从程序坞或开始菜单打开的桌面应用，再讲大多数人接下来会调的几个参数。不想在本机装任何东西的话，可以直接下载[现成应用](https://github.com/tw93/Pake/releases/latest)，或者用 [GitHub Actions 在线打包](github-actions-usage_CN.md)。

## 准备环境

Pake 需要 Node.js 20.9 以上和 Rust 1.85 以上，先看看本机已经有哪些：

```bash
node -v
rustc --version
```

没有 Rust 也可以先往下走，第一次打包时 Pake 会问你要不要帮你装。每个平台还各自需要一套构建工具：

- **macOS**：Xcode 命令行工具，用 `xcode-select --install` 安装。
- **Windows**：带 C++ 工作负载的 Visual Studio Build Tools，之前没配过的话照着 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)装一遍。
- **Linux**：[进阶用法](advanced-usage_CN.md#前置条件)里列出的 WebKitGTK 开发包。

## 安装命令行工具

```bash
pnpm install -g pake-cli
```

用 `npm install -g pake-cli` 也行。全局安装报权限错误的话，可以不安装直接用 `npx pake-cli`，或者看 [FAQ](faq_CN.md#全局安装时权限被拒绝) 里的办法。

## 打包第一个应用

给一个网址和一个名字：

```bash
pake https://excalidraw.com --name Excalidraw
```

Pake 会自动取网站图标，第一次打包时顺带装好 Rust 工具链，然后把安装包写到当前目录，macOS 上是 `.dmg`，Windows 上是 `.msi`，Debian 和 Ubuntu 上是 `.deb` 加 AppImage，Fedora 这类 RPM 系发行版上是 `.rpm` 加 AppImage。第一次要下载和编译依赖，通常要等几分钟，之后再打包就快多了。

安装包像普通应用一样打开就行，macOS 上加 `--install` 可以跳过 DMG，直接装进 `/Applications`。

## 调整窗口

大多数应用只需要再加几个参数：

```bash
pake https://excalidraw.com --name Excalidraw --width 1400 --height 900 --hide-title-bar
```

- `--width` 和 `--height` 设置初始窗口大小，默认是 1200 乘 780。
- `--hide-title-bar` 在 macOS 上隐藏标题栏，页面一直铺到窗口顶部。
- 网站自带的图标不好看时，用 `--icon` 指定本地或远程图片，[macOSicons](https://macosicons.com/#/) 上能找到不少。
- `--show-system-tray` 让应用常驻菜单栏或系统托盘。

全部参数和示例都在[命令行参数说明](cli-usage_CN.md)里。

## 让登录和链接正常工作

需要跳到别的域名登录，或者会在新窗口打开链接的网站，可能还要再加一个参数：

- `--safe-domain` 列出需要留在应用内打开的其他域名，比如企业单点登录的域名。
- `--new-window` 允许网站弹出自己的窗口，有些 OAuth 登录流程需要它。
- `--multi-window` 允许同一个应用开多个窗口。

Google 等少数登录方不管加什么参数，都会拦截内嵌 WebView 里的登录，[FAQ](faq_CN.md#网站功能不工作登录上传等) 里写了还有哪些办法。

## 打包本地的前端项目

Pake 也能打包你自己的前端构建产物，做好的静态站点或小工具可以直接变成桌面应用：

```bash
pake ./dist --name MyTool
```

文件夹根目录要有 `index.html`，路由只支持 hash 模式，不支持 history 模式。

## 交给脚本和 Agent

给脚本或 AI Agent 用的时候，加上 `--json`，标准输出只会有一个 JSON 结果，退出码也是固定的，参数多的话可以用 `--config app.json` 写成配置文件，不用拼一长串命令。[config](cli-usage_CN.md#config) 和 [json](cli-usage_CN.md#json) 两节讲了具体用法，Agent 应该先读 [llms.txt](../llms.txt)。

## 接下来

- [命令行参数说明](cli-usage_CN.md)：全部参数和示例
- [进阶用法](advanced-usage_CN.md)：注入 CSS 和 JavaScript，做更多定制
- [常见问题](faq_CN.md)：按平台整理的构建和运行问题
