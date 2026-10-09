<div align="center">
  <img src="https://gw.alipayobjects.com/zos/k/fa/logo-modified.png" width="138" />
  <h1>Pake</h1>
  <p><b>把常用網頁變身小巧好用的電腦軟體，支援 macOS、Windows 與 Linux</b></p>
  <p><a href="README.md">English</a> · <a href="README_CN.md">中文</a> · 繁體 · <a href="README_JA.md">日本語</a> · <a href="README_KR.md">한국어</a> · <a href="README_DE.md">Deutsch</a> · <a href="README_FR.md">Français</a></p>
  <a href="https://twitter.com/HiTw93" target="_blank"><img alt="twitter" src="https://img.shields.io/badge/follow-Tw93-red?style=flat-square&logo=Twitter"></a>
  <a href="https://t.me/+9f9gf4ZrFSQ2OWVl" target="_blank"><img alt="telegram" src="https://img.shields.io/badge/chat-telegram-blueviolet?style=flat-square&logo=Telegram"></a>
  <a href="https://github.com/tw93/Pake/releases" target="_blank"><img alt="GitHub downloads" src="https://img.shields.io/github/downloads/tw93/Pake/total.svg?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/commits" target="_blank"><img alt="GitHub commit" src="https://img.shields.io/github/commit-activity/m/tw93/Pake?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/issues?q=is%3Aissue+is%3Aclosed" target="_blank"><img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/tw93/Pake.svg?style=flat-square"></a>
</div>

## 特性

- 🎐 **體積小巧**：安裝包比 Electron 應用小近 20 倍，通常小於 10 MB
- 🚀 **效能優異**：基於 Rust Tauri，比傳統 JS 框架更快，記憶體占用更少
- ⚡ **使用簡單**：命令列一行打包，或線上構建，無需繁瑣設定
- 📦 **功能豐富**：支援快捷鍵透傳、沉浸式視窗、拖曳、樣式自訂、去除廣告

## 快速開始

- **新手用戶**：直接下載現成的 [常用包](#常用包下載)，或透過 [線上構建](docs/github-actions-usage_CN.md) 無需環境配置即可打包
- **開發者**：安裝 [CLI 工具](docs/cli-usage_CN.md) 後一行命令打包任意網站，支援自訂圖示、視窗等參數
- **進階用戶**：本機複製專案進行 [自訂開發](#自訂開發)，或查看 [進階用法](docs/advanced-usage_CN.md) 實現樣式自訂、功能擴充
- **遇到問題**：查看 [常見問題](docs/faq_CN.md) 排查故障與使用疑問

## 常用包下載

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

<summary>🏂 更多應用可去 <a href="https://github.com/tw93/Pake/releases">Release</a> 下載，<b>點選展開快捷鍵說明</b></summary>

<br/>

| Mac                                                       | Windows/Linux                                       | 功能                 |
| --------------------------------------------------------- | --------------------------------------------------- | -------------------- |
| <kbd>⌘</kbd> + <kbd>[</kbd>                               | <kbd>Ctrl</kbd> + <kbd>←</kbd>                      | 返回上一頁           |
| <kbd>⌘</kbd> + <kbd>]</kbd>                               | <kbd>Ctrl</kbd> + <kbd>→</kbd>                      | 前進到下一頁         |
| <kbd>⌘</kbd> + <kbd>↑</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↑</kbd>                      | 自動捲動到頁面頂端   |
| <kbd>⌘</kbd> + <kbd>↓</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↓</kbd>                      | 自動捲動到頁面底部   |
| <kbd>⌘</kbd> + <kbd>r</kbd>                               | <kbd>Ctrl</kbd> + <kbd>r</kbd>                      | 重新整理頁面         |
| <kbd>⌘</kbd> + <kbd>w</kbd>                               | <kbd>Ctrl</kbd> + <kbd>w</kbd>                      | 隱藏視窗（非退出）   |
| <kbd>⌘</kbd> + <kbd>-</kbd>                               | <kbd>Ctrl</kbd> + <kbd>-</kbd>                      | 縮小頁面             |
| <kbd>⌘</kbd> + <kbd>=</kbd>                               | <kbd>Ctrl</kbd> + <kbd>=</kbd>                      | 放大頁面             |
| <kbd>⌘</kbd> + <kbd>0</kbd>                               | <kbd>Ctrl</kbd> + <kbd>0</kbd>                      | 重設頁面縮放         |
| <kbd>⌘</kbd> + <kbd>L</kbd>                               | <kbd>Ctrl</kbd> + <kbd>L</kbd>                      | 複製目前頁面網址     |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>   | 貼上並符合樣式       |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>H</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>   | 回到首頁             |
| <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>I</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>   | 開啟偵錯（僅開發版） |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌫</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd> | 清除快取並重啟       |
| <kbd>⌃</kbd> + <kbd>⌘</kbd> + <kbd>F</kbd>                | <kbd>F11</kbd>                                      | 切換原生全螢幕       |

此外還支援雙擊標題列切換全螢幕。Windows 與 Linux 可使用 `--hide-window-decorations` 建立頂部具拖曳區域的無邊框視窗。Mac 支援手勢滑動返回與前進，選單列也提供導覽、縮放與視窗控制等選項。

</details>

## 命令列一行打包

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake1.gif)

```bash
# 安裝 Pake CLI
pnpm install -g pake-cli

# 基本用法 - 自動取得網站圖示
pake https://github.com --name GitHub

# 進階用法：自訂選項
pake https://weekly.tw93.fun --name Weekly --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar
```

首次打包需要準備構建環境，耗時會稍長一些，後續打包會很快。完整參數說明查看 [CLI 使用指南](docs/cli-usage_CN.md)，不想用命令列可以試試 [GitHub Actions 線上構建](docs/github-actions-usage_CN.md)。

在腳本或 AI agent 裡使用 Pake？加上 `--json` 取得機器可讀結果，使用 `--config app.json` 宣告式描述應用（[schema](schema/pake.schema.json)），本機構建產物可直接 `pake ./dist --name MyTool` 打包。完整 agent 契約見 [llms.txt](llms.txt)。安裝官方 skill 在 Claude Code 裡執行 `/plugin marketplace add tw93/Pake` 和 `/plugin install pake@pake`，在 Codex 裡執行 `codex plugin marketplace add tw93/Pake` 和 `codex plugin add pake@pake`。

把下面這段複製給你的 AI agent 即可開始：

```text
用 Pake（npm i -g pake-cli）把網頁打包成桌面應用。先閱讀 https://unpkg.com/pake-cli@latest/llms.txt，執行 pake 時始終加上 --json 並把 stdout 解析為單個 JSON 物件。把 <url-or-local-dist> 打包成名為 <AppName> 的應用。
```

## 定制開發

需要 Rust `>=1.85` 與 Node `>=22`（推薦 LTS，較舊的 `>=20` 亦可使用），詳細安裝指南參考 [Tauri 文件](https://tauri.app/start/prerequisites/)。不熟悉開發環境建議直接使用命令列工具。

```bash
# 安裝依賴
pnpm i

# 本機開發［右鍵可開啟偵錯模式］
pnpm run dev

# 打包應用
pnpm run build
```

想要樣式自訂、功能擴充、容器通訊等進階玩法，查看 [進階用法文件](docs/advanced-usage_CN.md)。

## 開發者

Pake 的發展離不開這些優秀的貢獻者 ❤️

<a href="https://github.com/tw93/Pake/graphs/contributors">
  <img src="https://raw.githubusercontent.com/tw93/Pake/main/CONTRIBUTORS.svg?sanitize=true" alt="Contributors" width="1000" />
</a>

## 支持

1. 購買我做的 Mac 清理應用 [Mole for Mac](https://mole.fit)，是對我最直接的支持。
2. 如果你喜歡 Pake，可以在 GitHub 給一顆 Star，也歡迎 [推薦](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20把常用網頁變身小巧好用的電腦軟體，支援%20macOS、Windows%20與%20Linux) 給志同道合的朋友。
3. 可以追蹤我的 [Twitter](https://twitter.com/HiTw93) 獲取最新的 Pake 更新消息，也歡迎加入 [Telegram](https://t.me/+9f9gf4ZrFSQ2OWVl) 聊天群組。
4. 希望大家在使用過程中能體會到學習新技術的樂趣，若發現適合做成桌面 App 的網頁也歡迎告訴我。
5. 我養了兩隻貓：湯圓與可樂，如果 Pake 讓你的生活更美好，可以給她們 <a href="https://cats.tw93.fun?name=Pake" target="_blank">餵罐頭 🥩</a>。

<details>
<summary>這些可愛的朋友已經贊助過 🐱</summary>
<br/>
<a href="https://cats.tw93.fun?name=Pake"><img src="https://cdn.jsdelivr.net/gh/tw93/sponsors@main/assets/sponsors.svg" width="1000px" /></a>
</details>

## 開源授權

Pake 使用 GPL-3.0 條款開源，詳見 [LICENSE](./LICENSE) 與 [Pake Output Exception](./LICENSE-EXCEPTION)；用 Pake 打包生成的應用所有權完全歸你，可以自由使用和發布。如果你想基於 fork 重新做一個 Pake 產品，為了避免誤解，請更換名稱並註明出處。
