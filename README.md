<h4 align="right"><strong>English</strong> | <a href="README_CN.md">简体中文</a> | <a href="README_JP.md">日本語</a></h4>
<p align="center">
    <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
</p>
<h1 align="center">Pake</h1>
<p align="center"><strong>Turn any webpage into a desktop app with Rust <em>with ease</em>.</strong></p>
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
    <a href="https://colab.research.google.com/drive/1bX345znvDZ30848xjRtpgtU8eypWwXrp?usp=sharing" target="_blank">
    <img alt="Open in Colab" src="https://colab.research.google.com/assets/colab-badge.svg"></a>
</div>

<div align="left">Pake supports Mac, Windows, and Linux. Check out README for <a href="#popular-packages">Popular Packages</a>, <a href="#command-line-packaging">Command-Line Packaging</a>, and <a href="#development">Customized Development</a> information. Feel free to share your suggestions in <a href=https://github.com/tw93/Pake/discussions>Discussions</a>.</div>

## Features

- 🎐 Nearly 20 times smaller than an Electron package (around 5M!)
- 🚀 With Rust Tauri, Pake is much more lightweight and faster than JS-based frameworks.
- 📦 Battery-included package — shortcut pass-through, immersive windows, and minimalist customization.
- 🖱️ Smart right-click context menus with download support for images, videos, and files.
- 👻 Pake is just a simple tool — replaces the old bundle approach with Tauri (though PWA is also a good alternative).

## Popular Packages

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
<summary>🏂 You can download more applications from <a href="https://github.com/tw93/Pake/releases">Releases</a>. <b>Click here to expand the shortcuts reference!</b></summary>

<br/>

| Mac                         | Windows/Linux                  | Function                      |
| --------------------------- | ------------------------------ | ----------------------------- |
| <kbd>⌘</kbd> + <kbd>[</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> | Return to the previous page   |
| <kbd>⌘</kbd> + <kbd>]</kbd> | <kbd>Ctrl</kbd> + <kbd>→</kbd> | Go to the next page           |
| <kbd>⌘</kbd> + <kbd>↑</kbd> | <kbd>Ctrl</kbd> + <kbd>↑</kbd> | Auto scroll to top of page    |
| <kbd>⌘</kbd> + <kbd>↓</kbd> | <kbd>Ctrl</kbd> + <kbd>↓</kbd> | Auto scroll to bottom of page |
| <kbd>⌘</kbd> + <kbd>r</kbd> | <kbd>Ctrl</kbd> + <kbd>r</kbd> | Refresh Page                  |
| <kbd>⌘</kbd> + <kbd>w</kbd> | <kbd>Ctrl</kbd> + <kbd>w</kbd> | Hide window, not quit         |
| <kbd>⌘</kbd> + <kbd>-</kbd> | <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom out the page             |
| <kbd>⌘</kbd> + <kbd>+</kbd> | <kbd>Ctrl</kbd> + <kbd>+</kbd> | Zoom in the page              |
| <kbd>⌘</kbd> + <kbd>=</kbd> | <kbd>Ctrl</kbd> + <kbd>=</kbd> | Zoom in the Page              |
| <kbd>⌘</kbd> + <kbd>0</kbd> | <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset the page zoom           |

In addition, double-click the title bar to switch to full-screen mode. For Mac users, you can also use the gesture to go to the previous or next page and drag the title bar to move the window.

</details>

## Before starting

1. **For beginners**: Play with Popular Packages to find out Pake's capabilities, or try to pack your application with [GitHub Actions](docs/github-actions-usage.md). Don't hesitate to reach for assistance at [Discussion](https://github.com/tw93/Pake/discussions)!
2. **For developers**: “Command-Line Packaging” supports macOS fully. For Windows/Linux users, it requires some tinkering. [Configure your environment](https://tauri.app/start/prerequisites/) before getting started.
3. **For hackers**: For people who are good at both front-end development and Rust, how about customizing your apps' function more with the following [Customized Development](#development)?

## Command-Line Packaging

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake.gif)

**Pake provides a command line tool, making the flow of package customization quicker and easier. See the [CLI usage guide](docs/cli-usage.md) for more information.**

```bash
# Recommended (pnpm)
pnpm install -g pake-cli

# Alternative (npm)
npm install -g pake-cli

# Command usage
pake url [OPTIONS]...

# Feel free to play with Pake! It might take a while to prepare the environment the first time you launch Pake.
pake https://weekly.tw93.fun --name Weekly --hide-title-bar
```

If you are new to the command line, you can compile packages online with _GitHub Actions_. See our [documentation](#documentation) for detailed guides.

## Development

Prepare your environment before starting. Make sure you have Rust `>=1.89` and Node `>=18` (e.g., `22.11.0`) installed on your computer. _Note: Latest stable versions are recommended._ For installation guidance, see [Tauri documentation](https://tauri.app/start/prerequisites/).

If you are unfamiliar with these, it is better to try out the above tool to pack with one click.

```sh
# Install dependencies
pnpm i

# Local development (right-click to open debug mode)
pnpm run dev

# Build application
pnpm run build
```

## Documentation

- **[CLI Usage](docs/cli-usage.md)** | [中文](docs/cli-usage_CN.md) - Command-line interface reference
- **[Advanced Usage](docs/advanced-usage.md)** | [中文](docs/advanced-usage_CN.md) - Customization and advanced features
- **[GitHub Actions](docs/github-actions-usage.md)** | [中文](docs/github-actions-usage_CN.md) - Build apps online
- **[Pake Action](docs/pake-action.md)** - Use Pake as GitHub Action in your projects
- **[Contributing](CONTRIBUTING.md)** - How to contribute to development

## Developers

Pake's development can not be without these Hackers. They contributed a lot of capabilities for Pake. Also, welcome to follow them! ❤️

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
		</tr>
		<tr>
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
                    <sub><b>Null</b></sub>
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
		</tr>
		<tr>
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

## Support

1. I have two cats, TangYuan and Coke. If you think Pake delights your life, you can feed them <a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">some canned food 🥩</a>.
2. If you like Pake, you can star it on GitHub. Also, welcome to [recommend Pake](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=%23Pake%20-%20A%20simple%20Rust%20packaged%20web%20pages%20to%20generate%20Mac%20App%20tool,%20compared%20to%20traditional%20Electron%20package,%20the%20size%20of%20nearly%2040%20times%20smaller,%20generally%20about%202M,%20the%20underlying%20use%20of%20Tauri,%20performance%20experience%20than%20the%20JS%20framework%20is%20much%20lighter~) to your friends.
3. You can follow my [Twitter](https://twitter.com/HiTw93) to get the latest news of Pake or join our [Telegram](https://t.me/+GclQS9ZnxyI2ODQ1) chat group.
4. I hope that you enjoy playing with it. Let us know if you find a website that would be great for a Mac App!
