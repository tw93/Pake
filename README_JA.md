<div align="center">
  <img src="https://gw.alipayobjects.com/zos/k/fa/logo-modified.png" width="138" />
  <h1>Pake</h1>
  <p><b>あらゆるウェブページをコマンド一つでデスクトップアプリに変換。macOS、Windows、Linux に対応</b></p>
  <p><a href="README.md">English</a> · <a href="README_CN.md">中文</a> · <a href="README_TW.md">繁體</a> · 日本語 · <a href="README_KR.md">한국어</a> · <a href="README_DE.md">Deutsch</a> · <a href="README_FR.md">Français</a></p>
  <a href="https://twitter.com/HiTw93" target="_blank"><img alt="twitter" src="https://img.shields.io/badge/follow-Tw93-red?style=flat-square&logo=Twitter"></a>
  <a href="https://t.me/+9f9gf4ZrFSQ2OWVl" target="_blank"><img alt="telegram" src="https://img.shields.io/badge/chat-telegram-blueviolet?style=flat-square&logo=Telegram"></a>
  <a href="https://github.com/tw93/Pake/releases" target="_blank"><img alt="GitHub downloads" src="https://img.shields.io/github/downloads/tw93/Pake/total.svg?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/commits" target="_blank"><img alt="GitHub commit" src="https://img.shields.io/github/commit-activity/m/tw93/Pake?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/issues?q=is%3Aissue+is%3Aclosed" target="_blank"><img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/tw93/Pake.svg?style=flat-square"></a>
</div>

## 特徴

- 🎐 **軽量**：Electron アプリと比べて約 20 分の 1 のサイズ、通常 10 MB 未満
- 🚀 **高速**：Rust Tauri を採用し、従来の JS フレームワークより軽快で低メモリ消費
- ⚡ **簡単**：CLI コマンド 1 つ、またはオンラインビルドで、複雑な設定なしですぐにパッケージ化
- 📦 **高機能**：ショートカット透過、イマーシブウィンドウ、ドラッグ＆ドロップ、CSS カスタマイズ、広告非表示に対応

## はじめに

- **初心者**：ビルド済みの [人気パッケージ](#人気パッケージのダウンロード) をダウンロード、または環境構築不要の [GitHub Actions オンラインビルド](docs/github-actions-usage.md) を利用
- **開発者**：[CLI ツール](docs/cli-usage.md) をインストールし、コマンド 1 つで任意のサイトをアイコンやウィンドウ設定付きでパッケージ化
- **上級者**：リポジトリをクローンして [カスタム開発](#開発) を行うか、[高度な使い方](docs/advanced-usage.md) でスタイル調整や機能拡張を参照
- **トラブルシューティング**：[よくある質問（FAQ）](docs/faq.md) でトラブルシューティングと解決策を確認

## 人気パッケージのダウンロード

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

<summary>🏂 その他のアプリは <a href="https://github.com/tw93/Pake/releases">Releases</a> からダウンロードできます。<b>クリックしてショートカット一覧を表示</b></summary>

<br/>

| Mac                                                       | Windows/Linux                                       | 機能                                 |
| --------------------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| <kbd>⌘</kbd> + <kbd>[</kbd>                               | <kbd>Ctrl</kbd> + <kbd>←</kbd>                      | 前のページに戻る                     |
| <kbd>⌘</kbd> + <kbd>]</kbd>                               | <kbd>Ctrl</kbd> + <kbd>→</kbd>                      | 次のページに進む                     |
| <kbd>⌘</kbd> + <kbd>↑</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↑</kbd>                      | ページ最上部へスクロール             |
| <kbd>⌘</kbd> + <kbd>↓</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↓</kbd>                      | ページ最下部へスクロール             |
| <kbd>⌘</kbd> + <kbd>r</kbd>                               | <kbd>Ctrl</kbd> + <kbd>r</kbd>                      | ページを再読み込み                   |
| <kbd>⌘</kbd> + <kbd>w</kbd>                               | <kbd>Ctrl</kbd> + <kbd>w</kbd>                      | ウィンドウを隠す（終了ではない）     |
| <kbd>⌘</kbd> + <kbd>-</kbd>                               | <kbd>Ctrl</kbd> + <kbd>-</kbd>                      | ページを縮小                         |
| <kbd>⌘</kbd> + <kbd>=</kbd>                               | <kbd>Ctrl</kbd> + <kbd>=</kbd>                      | ページを拡大                         |
| <kbd>⌘</kbd> + <kbd>0</kbd>                               | <kbd>Ctrl</kbd> + <kbd>0</kbd>                      | ズームをリセット                     |
| <kbd>⌘</kbd> + <kbd>L</kbd>                               | <kbd>Ctrl</kbd> + <kbd>L</kbd>                      | 現在の URL をコピー                  |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>   | スタイルを合わせて貼り付け           |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>H</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>   | ホームに戻る                         |
| <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>I</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>   | 開発者ツールを開く（デバッグ版のみ） |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌫</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd> | キャッシュをクリアして再起動         |
| <kbd>⌃</kbd> + <kbd>⌘</kbd> + <kbd>F</kbd>                | <kbd>F11</kbd>                                      | フルスクリーン切り替え               |

タイトルバーをダブルクリックしてフルスクリーンを切り替えることもできます。Windows と Linux では `--hide-window-decorations` を指定することで、上部ドラッグ領域を備えたフレームレスウィンドウを作成可能。Mac ではスワイプジェスチャーによる進む・戻るや、メニューバーからのウィンドウ制御にも対応しています。

</details>

## CLI でワンコマンドパッケージ化

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake1.gif)

```bash
# Pake CLI のインストール
pnpm install -g pake-cli

# 基本的な使い方 - ファビコンを自動取得
pake https://github.com --name GitHub

# 高度な使い方 - オプションのカスタマイズ
pake https://weekly.tw93.fun --name Weekly --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar
```

初回のパッケージ化はビルド環境の準備が必要なため少し時間がかかりますが、次回以降は高速に完了します。全オプションの詳細は [CLI 使用ガイド](docs/cli-usage.md) を参照してください。コマンドラインを使わない場合は [GitHub Actions オンラインビルド](docs/github-actions-usage.md) も利用できます。

スクリプトや AI agent から Pake を利用する場合：`--json` を指定して結果をパースし、`--config app.json`（[schema](schema/pake.schema.json)）で宣言的に設定できます。ローカルのビルド成果物は `pake ./dist --name MyTool` で直接パッケージ化可能。完全な agent 仕様は [llms.txt](llms.txt) を参照してください。公式 skill をインストールする場合、Claude Code では `/plugin marketplace add tw93/Pake` と `/plugin install pake@pake`、Codex では `codex plugin marketplace add tw93/Pake` と `codex plugin add pake@pake` を実行します。

AI agent に以下のテキストを渡して指示できます：

```text
Pake（npm i -g pake-cli）を使ってウェブページをデスクトップアプリにパッケージ化してください。まず https://unpkg.com/pake-cli@latest/llms.txt を読み、常に --json を付けて実行し stdout を単一の JSON オブジェクトとしてパースしてください。<url-or-local-dist> を <AppName> という名前でパッケージ化します。
```

## 開発

Rust `>=1.85` と Node `>=22`（推奨 LTS、`>=20.9` も利用可能）が必要です。環境構築の詳細は [Tauri 公式ドキュメント](https://tauri.app/start/prerequisites/) を参照してください。環境構築に不慣れな場合は CLI ツールの利用をおすすめします。

```bash
# 依存関係のインストール
pnpm i

# ローカル開発［右クリックでデバッグモードを開く］
pnpm run dev

# アプリケーションのビルド
pnpm run build
```

スタイルのカスタマイズ、機能拡張、コンテナ通信などの高度な利用法は、[高度な使い方ガイド](docs/advanced-usage.md) をご覧ください。

## コントリビューター

Pake の成長は多くのコントリビューターに支えられています ❤️

<a href="https://github.com/tw93/Pake/graphs/contributors">
  <img src="https://raw.githubusercontent.com/tw93/Pake/main/CONTRIBUTORS.svg?sanitize=true" alt="Contributors" width="1000" />
</a>

## サポート

1. 最も直接的な支援は、個人開発の Mac クリーナーアプリ [Mole for Mac](https://mole.fit) を購入していただくことです。
2. Pake が気に入ったら、GitHub で Star を付けたり、[周りの開発者仲間におすすめ](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20あらゆるウェブページをコマンド一つでデスクトップアプリに変換。macOS、Windows、Linux%20に対応) していただけると嬉しいです。
3. 最新のアップデート情報は [Twitter](https://twitter.com/HiTw93) で発信しています。[Telegram](https://t.me/+9f9gf4ZrFSQ2OWVl) グループにもお気軽にご参加ください。
4. 新しい技術を試す楽しさを感じていただければ幸いです。デスクトップアプリ化にぴったりのウェブサイトを見つけたら、ぜひ教えてください。
5. TangYuan と Coke という 2 匹の猫を飼っています。Pake で日々の作業が快適になったら、<a href="https://cats.tw93.fun?name=Pake" target="_blank">おやつ 🥩</a> をごちそうしていただけると励みになります。

<details>
<summary>支援してくださった方々 🐱</summary>
<br/>
<a href="https://cats.tw93.fun?name=Pake"><img src="https://cdn.jsdelivr.net/gh/tw93/sponsors@main/assets/sponsors.svg" width="1000px" /></a>
</details>

## オープンソースライセンス

Pake は GPL-3.0 ライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) および [Pake Output Exception](./LICENSE-EXCEPTION) を参照してください。Pake で作成したアプリの所有権はすべてあなたに帰属し、自由に使用および配布できます。フォークして独立した製品を作成する場合は、混同を避けるため別の名前を付け、出典を明記してください。
