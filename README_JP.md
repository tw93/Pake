<h4 align="right"><a href="README.md">English</a> | <a href="README_CN.md">简体中文</a> | <strong>日本語</strong></h4>
<p align="center">
    <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
</p>
<h1 align="center">Pake</h1>
<p align="center"><strong>ワンコマンドでウェブページをデスクトップアプリにパッケージ化、macOS、Windows、Linux対応</strong></p>
<div align="center">
    <a href="https://twitter.com/HiTw93" target="_blank">
    <img alt="twitter" src="https://img.shields.io/badge/follow-Tw93-red?style=flat-square&logo=Twitter"></a>
    <a href="https://t.me/+GclQS9ZnxyI2ODQ1" target="_blank">
    <img alt="telegram" src="https://img.shields.io/badge/chat-telegram-blueviolet?style=flat-square&logo=Telegram"></a>
    <a href="https://github.com/tw93/Pake/releases" target="_blank">
    <img alt="GitHub downloads" src="https://img.shields.io/github/downloads/tw93/Pake/total.svg?style=flat-square"></a>
    <a href="https://github.com/tw93/Pake/commits" target="_blank">
    <img alt="GitHub commit" src="https://img.shields.io/github/commit-activity/m/tw93/Pake?style=flat-square"></a>
    <a href="https://github.com/tw93/Pake/issues?q=is%3Aissue+is%3Aclosed" target="_blank">
    <img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/tw93/Pake.svg?style=flat-square"></a>
</div>

## 特徴

- 🎐 **軽量**: Electronより約20倍小さく、通常約5M
- 🚀 **高速**: Rust Tauriベースで、従来のJSフレームワークより高速、メモリ使用量も少ない
- ⚡ **使いやすい**: CLIでワンコマンドパッケージング、複雑な設定不要
- 📦 **高機能**: ショートカット透過、没入型ウィンドウ、ドラッグ&ドロップ、スタイルカスタマイズをサポート

## 快速開始

- **初心者**: 既成の[人気パッケージ](#人気のパッケージ)をダウンロード、または[オンライン構築](docs/github-actions-usage.md)で環境設定なしでパッケージ化
- **開発者**: [CLIツール](docs/cli-usage.md)インストール後、ワンコマンドで任意のウェブサイトをパッケージ化、アイコンやウィンドウなどのパラメータをカスタマイズ可能
- **上級者**: プロジェクトをローカルクローンして[カスタム開発](#開発)、または[高級用法](docs/advanced-usage.md)でスタイルカスタマイズ・機能拡張を実現

## 人気のパッケージ

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
</table>

<details>
<summary>🏂 <a href="https://github.com/tw93/Pake/releases">リリース</a>からさらに多くのアプリケーションをダウンロードできます。<b>ここをクリックしてショートカットの参照を展開してください！</b></summary>

<br/>

| Mac                         | Windows/Linux                  | 機能                           |
| --------------------------- | ------------------------------ | ------------------------------ |
| <kbd>⌘</kbd> + <kbd>[</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> | 前のページに戻る               |
| <kbd>⌘</kbd> + <kbd>]</kbd> | <kbd>Ctrl</kbd> + <kbd>→</kbd> | 次のページに進む               |
| <kbd>⌘</kbd> + <kbd>↑</kbd> | <kbd>Ctrl</kbd> + <kbd>↑</kbd> | ページのトップに自動スクロール |
| <kbd>⌘</kbd> + <kbd>↓</kbd> | <kbd>Ctrl</kbd> + <kbd>↓</kbd> | ページの底に自動スクロール     |
| <kbd>⌘</kbd> + <kbd>r</kbd> | <kbd>Ctrl</kbd> + <kbd>r</kbd> | ページをリフレッシュ           |
| <kbd>⌘</kbd> + <kbd>w</kbd> | <kbd>Ctrl</kbd> + <kbd>w</kbd> | ウィンドウを隠す、終了しない   |
| <kbd>⌘</kbd> + <kbd>-</kbd> | <kbd>Ctrl</kbd> + <kbd>-</kbd> | ページを縮小                   |
| <kbd>⌘</kbd> + <kbd>+</kbd> | <kbd>Ctrl</kbd> + <kbd>+</kbd> | ページを拡大                   |
| <kbd>⌘</kbd> + <kbd>=</kbd> | <kbd>Ctrl</kbd> + <kbd>=</kbd> | ページを拡大                   |
| <kbd>⌘</kbd> + <kbd>0</kbd> | <kbd>Ctrl</kbd> + <kbd>0</kbd> | ページのズームをリセット       |

さらに、タイトルバーをダブルクリックして全画面モードに切り替えることができます。Mac ユーザーは、ジェスチャーを使用して前のページまたは次のページに移動することもできます。ウィンドウを移動するには、タイトルバーをドラッグします。

</details>

## コマンドラインパッケージング

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake1.gif)

```bash
# Pake CLIをインストール
pnpm install -g pake-cli

# 基本使用法 - ウェブサイトのアイコンを自動取得
pake https://github.com --name GitHub

# 高級使用法：カスタムオプション
pake https://weekly.tw93.fun --name Weekly --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar
```

初回パッケージ化は環境設定で時間がかかりますが、その後は高速です。完全なパラメータ説明は[CLI使用ガイド](docs/cli-usage.md)を参照してください。コマンドラインを使いたくない場合は[GitHub Actions オンライン構築](docs/github-actions-usage.md)をお試しください。

## 開発

Rust `>=1.89` と Node `>=22` が必要です。詳細なインストールガイドは[Tauriドキュメント](https://tauri.app/start/prerequisites/)を参照してください。開発環境に不慣れな場合は、直接コマンドラインツールの使用をお勧めします。

```bash
# 依存関係のインストール
pnpm i

# ローカル開発[右クリックでデバッグモード開可]
pnpm run dev

# アプリケーションのビルド
pnpm run build
```

スタイルカスタマイズ、機能拡張、コンテナ通信などの高度な機能については、[高級使用法ドキュメント](docs/advanced-usage.md)を参照してください。

## 開発者

Pake の開発はこれらのハッカーたちなしにはあり得ませんでした。彼らは Pake のために多くの能力を貢献しました。彼らをフォローすることも歓迎します！❤️

<a href="https://github.com/tw93/Pake/graphs/contributors">
  <img src="https://raw.githubusercontent.com/tw93/Pake/main/CONTRIBUTORS.svg?sanitize=true" alt="Contributors" width="1000" />
</a>

## サポート

<a href="https://miaoyan.app/cats.html?name=Pake"><img src="https://miaoyan.app/assets/sponsors.svg" width="1000px" /></a>

1. 私には汤圆と可乐という 2 匹の猫がいます。Pake があなたの生活をより良くしてくれると思ったら、<a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">缶詰をあげてください 🥩</a>。
2. Pake が気に入ったら、GitHub でスターをつけてください。また、友達に<a href="https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20Rust%E3%81%A7%E3%82%A6%E3%82%A7%E3%83%96%E3%83%9A%E3%83%BC%E3%82%B8%E3%82%92%E3%83%87%E3%82%B9%E3%82%AF%E3%83%88%E3%83%83%E3%83%97%E3%82%A2%E3%83%97%E3%83%AA%E3%81%AB%E5%A4%89%E6%8F%9B%E3%80%81Electron%E3%82%88%E3%82%8A20%E5%80%8D%E5%B0%8F%E3%81%95%E3%81%84%E3%80%81Mac%20Windows%20Linux%E5%AF%BE%E5%BF%9C">推薦</a>することを歓迎します。
3. 私の<a href="https://twitter.com/HiTw93">Twitter</a>をフォローして、Pake の最新情報を入手することができます。また、<a href="https://t.me/+GclQS9ZnxyI2ODQ1">Telegram</a>のチャットグループに参加することもできます。
4. 皆さんが楽しんでいただけることを願っています。Mac アプリに適したウェブサイトを見つけたら、ぜひ教えてください。
