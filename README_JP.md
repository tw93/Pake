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

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/tw93">
                    <img src="https://avatars.githubusercontent.com/u/8736212?v=4" width="90;" alt="tw93"/>
                    <br />
                    <sub><b>Tw93</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Tlntin">
                    <img src="https://avatars.githubusercontent.com/u/28218658?v=4" width="90;" alt="Tlntin"/>
                    <br />
                    <sub><b>Tlntin</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/jeasonnow">
                    <img src="https://avatars.githubusercontent.com/u/16950207?v=4" width="90;" alt="jeasonnow"/>
                    <br />
                    <sub><b>Santree</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/pan93412">
                    <img src="https://avatars.githubusercontent.com/u/28441561?v=4" width="90;" alt="pan93412"/>
                    <br />
                    <sub><b>Pan93412</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/stone-w4tch3r">
                    <img src="https://avatars.githubusercontent.com/u/100294019?v=4" width="90;" alt="stone-w4tch3r"/>
                    <br />
                    <sub><b>Данил Бизимов</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/wanghanzhen">
                    <img src="https://avatars.githubusercontent.com/u/25301012?v=4" width="90;" alt="wanghanzhen"/>
                    <br />
                    <sub><b>Volare</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/liby">
                    <img src="https://avatars.githubusercontent.com/u/38807139?v=4" width="90;" alt="liby"/>
                    <br />
                    <sub><b>Bryan Lee</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/essesoul">
                    <img src="https://avatars.githubusercontent.com/u/58624474?v=4" width="90;" alt="essesoul"/>
                    <br />
                    <sub><b>Essesoul</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/YangguangZhou">
                    <img src="https://avatars.githubusercontent.com/u/61733195?v=4" width="90;" alt="YangguangZhou"/>
                    <br />
                    <sub><b>Jerry Zhou</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/AielloChan">
                    <img src="https://avatars.githubusercontent.com/u/7900765?v=4" width="90;" alt="AielloChan"/>
                    <br />
                    <sub><b>Aiello</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/m1911star">
                    <img src="https://avatars.githubusercontent.com/u/4948120?v=4" width="90;" alt="m1911star"/>
                    <br />
                    <sub><b>Horus</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Pake-Actions">
                    <img src="https://avatars.githubusercontent.com/u/126550811?v=4" width="90;" alt="Pake-Actions"/>
                    <br />
                    <sub><b>Pake Actions</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/GoodbyeNJN">
                    <img src="https://avatars.githubusercontent.com/u/6856639?v=4" width="90;" alt="GoodbyeNJN"/>
                    <br />
                    <sub><b>GoodbyeNJN</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/eltociear">
                    <img src="https://avatars.githubusercontent.com/u/22633385?v=4" width="90;" alt="eltociear"/>
                    <br />
                    <sub><b>Ikko Eltociear Ashimine</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/kittizz">
                    <img src="https://avatars.githubusercontent.com/u/62899732?v=4" width="90;" alt="kittizz"/>
                    <br />
                    <sub><b>Kittizz</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/mattbajorek">
                    <img src="https://avatars.githubusercontent.com/u/17235301?v=4" width="90;" alt="mattbajorek"/>
                    <br />
                    <sub><b>Matt Bajorek</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/vaddisrinivas">
                    <img src="https://avatars.githubusercontent.com/u/38348871?v=4" width="90;" alt="vaddisrinivas"/>
                    <br />
                    <sub><b>Srinivas Vaddi</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/QingZ11">
                    <img src="https://avatars.githubusercontent.com/u/38887077?v=4" width="90;" alt="QingZ11"/>
                    <br />
                    <sub><b>Steam</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Tianj0o">
                    <img src="https://avatars.githubusercontent.com/u/68584284?v=4" width="90;" alt="Tianj0o"/>
                    <br />
                    <sub><b>Qitianjia</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/xinyii">
                    <img src="https://avatars.githubusercontent.com/u/17895104?v=4" width="90;" alt="xinyii"/>
                    <br />
                    <sub><b>Yi Xin</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/g1eny0ung">
                    <img src="https://avatars.githubusercontent.com/u/15034155?v=4" width="90;" alt="g1eny0ung"/>
                    <br />
                    <sub><b>Yue Yang</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/lkieryan">
                    <img src="https://avatars.githubusercontent.com/u/187804088?v=4" width="90;" alt="lkieryan"/>
                    <br />
                    <sub><b>Kieran</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/exposir">
                    <img src="https://avatars.githubusercontent.com/u/33340988?v=4" width="90;" alt="exposir"/>
                    <br />
                    <sub><b>孟世博</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/2nthony">
                    <img src="https://avatars.githubusercontent.com/u/19513289?v=4" width="90;" alt="2nthony"/>
                    <br />
                    <sub><b>2nthony</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/ACGNnsj">
                    <img src="https://avatars.githubusercontent.com/u/22112141?v=4" width="90;" alt="ACGNnsj"/>
                    <br />
                    <sub><b>Null</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/imabutahersiddik">
                    <img src="https://avatars.githubusercontent.com/u/138387257?v=4" width="90;" alt="imabutahersiddik"/>
                    <br />
                    <sub><b>Abu Taher Siddik</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/kidylee">
                    <img src="https://avatars.githubusercontent.com/u/841310?v=4" width="90;" alt="kidylee"/>
                    <br />
                    <sub><b>An Li</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/nekomeowww">
                    <img src="https://avatars.githubusercontent.com/u/11081491?v=4" width="90;" alt="nekomeowww"/>
                    <br />
                    <sub><b>Ayaka Neko</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/claude">
                    <img src="https://avatars.githubusercontent.com/u/81847?v=4" width="90;" alt="claude"/>
                    <br />
                    <sub><b>Claude</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/turkyden">
                    <img src="https://avatars.githubusercontent.com/u/24560160?v=4" width="90;" alt="turkyden"/>
                    <br />
                    <sub><b>Dengju Deng</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/fvn-elmy">
                    <img src="https://avatars.githubusercontent.com/u/71275745?v=4" width="90;" alt="fvn-elmy"/>
                    <br />
                    <sub><b>Fabien</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Fechin">
                    <img src="https://avatars.githubusercontent.com/u/2541482?v=4" width="90;" alt="Fechin"/>
                    <br />
                    <sub><b>Fechin</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/ImgBotApp">
                    <img src="https://avatars.githubusercontent.com/u/31427850?v=4" width="90;" alt="ImgBotApp"/>
                    <br />
                    <sub><b>Imgbot</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/droid-Q">
                    <img src="https://avatars.githubusercontent.com/u/708277?v=4" width="90;" alt="droid-Q"/>
                    <br />
                    <sub><b>Jiaqi Gu</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/JohannLai">
                    <img src="https://avatars.githubusercontent.com/u/10769405?v=4" width="90;" alt="JohannLai"/>
                    <br />
                    <sub><b>Johannlai</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/Jason6987">
                    <img src="https://avatars.githubusercontent.com/u/140222795?v=4" width="90;" alt="Jason6987"/>
                    <br />
                    <sub><b>Luminall</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Milo123459">
                    <img src="https://avatars.githubusercontent.com/u/50248166?v=4" width="90;" alt="Milo123459"/>
                    <br />
                    <sub><b>Milo</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/princemaple">
                    <img src="https://avatars.githubusercontent.com/u/1329716?v=4" width="90;" alt="princemaple"/>
                    <br />
                    <sub><b>Po Chen</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/beautifulrem">
                    <img src="https://avatars.githubusercontent.com/u/98527099?v=4" width="90;" alt="beautifulrem"/>
                    <br />
                    <sub><b>Xie Ruiqi</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/bocanhcam">
                    <img src="https://avatars.githubusercontent.com/u/35592955?v=4" width="90;" alt="bocanhcam"/>
                    <br />
                    <sub><b>bocanhcam</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/geekvest">
                    <img src="https://avatars.githubusercontent.com/u/126322776?v=4" width="90;" alt="geekvest"/>
                    <br />
                    <sub><b>Null</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/houhoz">
                    <img src="https://avatars.githubusercontent.com/u/19684376?v=4" width="90;" alt="houhoz"/>
                    <br />
                    <sub><b>Hyzhao</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/lakca">
                    <img src="https://avatars.githubusercontent.com/u/16255922?v=4" width="90;" alt="lakca"/>
                    <br />
                    <sub><b>Null</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/liudonghua123">
                    <img src="https://avatars.githubusercontent.com/u/2276718?v=4" width="90;" alt="liudonghua123"/>
                    <br />
                    <sub><b>Liudonghua</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/liusishan">
                    <img src="https://avatars.githubusercontent.com/u/33129823?v=4" width="90;" alt="liusishan"/>
                    <br />
                    <sub><b>Liusishan</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/piaoyidage">
                    <img src="https://avatars.githubusercontent.com/u/5135405?v=4" width="90;" alt="piaoyidage"/>
                    <br />
                    <sub><b>Ranger</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/hetz">
                    <img src="https://avatars.githubusercontent.com/u/820141?v=4" width="90;" alt="hetz"/>
                    <br />
                    <sub><b>贺天卓</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors -end -->

## サポート

1. 私には汤圆と可乐という 2 匹の猫がいます。Pake があなたの生活をより良くしてくれると思ったら、<a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">缶詰をあげてください 🥩</a>。
2. Pake が気に入ったら、GitHub でスターをつけてください。また、友達に<a href="https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20Rust%E3%81%A7%E3%82%A6%E3%82%A7%E3%83%96%E3%83%9A%E3%83%BC%E3%82%B8%E3%82%92%E3%83%87%E3%82%B9%E3%82%AF%E3%83%88%E3%83%83%E3%83%97%E3%82%A2%E3%83%97%E3%83%AA%E3%81%AB%E5%A4%89%E6%8F%9B%E3%80%81Electron%E3%82%88%E3%82%8A20%E5%80%8D%E5%B0%8F%E3%81%95%E3%81%84%E3%80%81Mac%20Windows%20Linux%E5%AF%BE%E5%BF%9C">推薦</a>することを歓迎します。
3. 私の<a href="https://twitter.com/HiTw93">Twitter</a>をフォローして、Pake の最新情報を入手することができます。また、<a href="https://t.me/+GclQS9ZnxyI2ODQ1">Telegram</a>のチャットグループに参加することもできます。
4. 皆さんが楽しんでいただけることを願っています。Mac アプリに適したウェブサイトを見つけたら、ぜひ教えてください。
