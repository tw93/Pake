<h4 align="right"><a href="README.md">English</a> | <strong>简体中文</strong></h4>
<p align="center">
    <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
</p>
<h1 align="center">Pake</h1>
<p align="center"><strong>一键打包网页生成轻量桌面应用，支持 macOS、Windows 和 Linux</strong></p>
<div align="center">
    <a href="https://twitter.com/HiTw93" target="_blank">
    <img alt="twitter" src="https://img.shields.io/badge/follow-Tw93-red?style=flat-square&logo=Twitter"></a>
    <a href="https://t.me/+9f9gf4ZrFSQ2OWVl" target="_blank">
    <img alt="telegram" src="https://img.shields.io/badge/chat-telegram-blueviolet?style=flat-square&logo=Telegram"></a>
    <a href="https://github.com/tw93/Pake/releases" target="_blank">
    <img alt="GitHub downloads" src="https://img.shields.io/github/downloads/tw93/Pake/total.svg?style=flat-square"></a>
    <a href="https://github.com/tw93/Pake/commits" target="_blank">
    <img alt="GitHub commit" src="https://img.shields.io/github/commit-activity/m/tw93/Pake?style=flat-square"></a>
    <a href="https://github.com/tw93/Pake/issues?q=is%3Aissue+is%3Aclosed" target="_blank">
    <img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/tw93/Pake.svg?style=flat-square"></a>
</div>

## 特征

- 🎐 **体积小巧**：安装包相比 Electron 应用小近 20 倍，通常小于 10M
- 🚀 **性能优异**：基于 Rust Tauri，比传统 JS 框架更快，内存占用更少
- ⚡ **使用简单**：命令行一键打包，或在线构建，无需复杂配置
- 📦 **功能丰富**：支持快捷键透传、沉浸式窗口、拖拽、样式定制、去广告

## 快速开始

- **新手用户**：直接下载现成的 [常用包](#常用包下载)，或通过 [在线构建](docs/github-actions-usage_CN.md) 无需环境配置即可打包
- **开发者**：安装 [CLI 工具](docs/cli-usage_CN.md) 后一行命令打包任意网站，支持自定义图标、窗口等参数
- **高级用户**：本地克隆项目进行 [定制开发](#定制开发)，或查看 [高级用法](docs/advanced-usage_CN.md) 实现样式定制、功能增强
- **遇到问题**：查看 [常见问题](docs/faq_CN.md) 获取常见问题的解决方案

## 常用包下载

<table>
    <tr>
        <td>WeRead
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead_x86_64.deb">Linux</a>
        </td>
        <td>Twitter
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/WeRead.jpg width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Twitter.jpg width=600/></td>
    </tr>
    <tr>
        <td>Grok
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok_x86_64.deb">Linux</a>
        </td>
        <td>DeepSeek
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Grok.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/DeepSeek.png width=600/></td>
    </tr>
    <tr>
        <td>ChatGPT
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT_x86_64.deb">Linux</a>
        </td>
        <td>Gemini
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/ChatGPT.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Gemini.png width=600/></td>
    </tr>
    <tr>
      <td>YouTube Music
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic_x86_64.deb">Linux</a>
      </td>
      <td>YouTube
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube_x86_64.deb">Linux</a>
      </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/YouTubeMusic.png width=600 /></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/YouTube.jpg width=600 /></td>
    </tr>
    <tr>
        <td>LiZhi
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi_x86_64.deb">Linux</a>
        </td>
        <td>ProgramMusic
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/LiZhi.jpg width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/ProgramMusic.jpg width=600/></td>
    </tr>
    <tr>
        <td>Excalidraw
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw_x86_64.deb">Linux</a>
        </td>
        <td>XiaoHongShu
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Excalidraw.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/XiaoHongShu.png width=600/></td>
    </tr>
    <tr>
        <td>Notion
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion_x86_64.deb">Linux</a>
        </td>
        <td>Flomo
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Notion.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Flomo.png width=600/></td>
    </tr>
</table>

<details>

<summary>🏂 更多应用可去 <a href="https://github.com/tw93/Pake/releases">Release</a>下载，<b>此外点击可展开快捷键说明</b></summary>

<br/>

| Mac                                                       | Windows/Linux                                       | 功能                |
| --------------------------------------------------------- | --------------------------------------------------- | ------------------- |
| <kbd>⌘</kbd> + <kbd>[</kbd>                               | <kbd>Ctrl</kbd> + <kbd>←</kbd>                      | 返回上一个页面      |
| <kbd>⌘</kbd> + <kbd>]</kbd>                               | <kbd>Ctrl</kbd> + <kbd>→</kbd>                      | 去下一个页面        |
| <kbd>⌘</kbd> + <kbd>↑</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↑</kbd>                      | 自动滚动到页面顶部  |
| <kbd>⌘</kbd> + <kbd>↓</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↓</kbd>                      | 自动滚动到页面底部  |
| <kbd>⌘</kbd> + <kbd>r</kbd>                               | <kbd>Ctrl</kbd> + <kbd>r</kbd>                      | 刷新页面            |
| <kbd>⌘</kbd> + <kbd>w</kbd>                               | <kbd>Ctrl</kbd> + <kbd>w</kbd>                      | 隐藏窗口,非退出     |
| <kbd>⌘</kbd> + <kbd>-</kbd>                               | <kbd>Ctrl</kbd> + <kbd>-</kbd>                      | 缩小页面            |
| <kbd>⌘</kbd> + <kbd>=</kbd>                               | <kbd>Ctrl</kbd> + <kbd>=</kbd>                      | 放大页面            |
| <kbd>⌘</kbd> + <kbd>0</kbd>                               | <kbd>Ctrl</kbd> + <kbd>0</kbd>                      | 重置页面缩放        |
| <kbd>⌘</kbd> + <kbd>L</kbd>                               | <kbd>Ctrl</kbd> + <kbd>L</kbd>                      | 复制当前页面网址    |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>   | 粘贴并匹配样式      |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>H</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>   | 回到首页            |
| <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>I</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>   | 开启调试 (仅开发版) |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌫</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd> | 清除缓存并重启      |
| <kbd>⌃</kbd> + <kbd>⌘</kbd> + <kbd>F</kbd>                | <kbd>F11</kbd>                                      | 切换原生全屏        |

此外还支持双击头部全屏切换。Windows 和 Linux 可使用 `--hide-window-decorations` 创建带顶部拖拽区域的无边框窗口。Mac 用户支持手势返回和前进，新菜单也提供了导航、缩放和窗口控制等选项。

</details>

## 命令行一键打包

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake1.gif)

```bash
# 安装 Pake CLI
pnpm install -g pake-cli

# 基础用法 - 自动获取网站图标
pake https://github.com --name GitHub

# 高级用法：自定义选项
pake https://weekly.tw93.fun --name Weekly --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar
```

首次打包需要安装环境会比较慢，后续很快。完整参数说明查看 [CLI 使用指南](docs/cli-usage_CN.md)，不想用命令行可以试试 [GitHub Actions 在线构建](docs/github-actions-usage_CN.md)。

在脚本或 AI agent 里使用 Pake？加 `--json` 获得机器可读结果，用 `--config app.json` 声明式描述应用（[schema](schema/pake.schema.json)），本地构建产物可直接 `pake ./dist --name MyTool` 打包。完整 agent 契约见 [llms.txt](llms.txt)。Claude Code 用户可通过 `/plugin marketplace add tw93/Pake` 和 `/plugin install pake@pake` 安装官方 skill。

把下面这段复制给你的 AI agent 即可开始：

```text
用 Pake（npm i -g pake-cli）把网页打包成桌面应用。先阅读 https://unpkg.com/pake-cli@latest/llms.txt，运行 pake 时始终加 --json 并把 stdout 解析为单个 JSON 对象。把 <url-or-local-dist> 打包成名为 <AppName> 的应用。
```

## 定制开发

需要 Rust `>=1.85` 和 Node `>=22`（推荐 LTS，较旧的 `>=18` 也可使用），详细安装指南参考 [Tauri 文档](https://tauri.app/start/prerequisites/)。不熟悉开发环境建议直接使用命令行工具。

```bash
# 安装依赖
pnpm i

# 本地开发[右键可打开调试模式]
pnpm run dev

# 打包应用
pnpm run build
```

想要样式定制、功能增强、容器通信等高级玩法，查看 [高级用法文档](docs/advanced-usage_CN.md)。

## 开发者

Pake 的发展离不开这些优秀的贡献者 ❤️

<a href="https://github.com/tw93/Pake/graphs/contributors">
  <img src="https://raw.githubusercontent.com/tw93/Pake/main/CONTRIBUTORS.svg?sanitize=true" alt="Contributors" width="1000" />
</a>

## 支持

1. 购买我做的 Mac 清理应用 [Mole for Mac](https://mole.fit)，是对我最直接的支持。
2. 如果你喜欢 Pake，可以在 Github Star，更欢迎 [推荐](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20一键打包网页生成轻量桌面应用，比%20Electron%20小%2020%20倍，支持%20macOS%20Windows%20Linux) 给志同道合的朋友使用。
3. 可以关注我的 [Twitter](https://twitter.com/HiTw93) 获取最新的 Pake 更新消息，也欢迎加入 [Telegram](https://t.me/+9f9gf4ZrFSQ2OWVl) 聊天群。
4. 希望大伙玩的过程中有一种学习新技术的喜悦感，发现适合做成桌面 App 的网页也欢迎告诉我。
5. 我有两只猫，一只叫汤圆，一只可乐，假如 Pake 让你生活更美好，可以给她们 <a href="https://cats.tw93.fun?name=Pake" target="_blank">喂罐头 🥩</a>。

<details>
<summary>这些可爱的朋友已经喂过了 🐱</summary>
<br/>
<a href="https://cats.tw93.fun?name=Pake"><img src="https://cdn.jsdelivr.net/gh/tw93/sponsors@main/assets/sponsors.svg" width="1000px" /></a>
</details>

## 开源协议

Pake 使用 GPL-3.0 协议开源，详见 [LICENSE](./LICENSE) 和 [Pake Output Exception](./LICENSE-EXCEPTION)，用 Pake 打包生成的应用所有权完全归你，可以自由使用和分发；假如你想基于 fork 重新做一个 Pake 产品，为了避免误解，辛苦换一个名字，并注明来源。
