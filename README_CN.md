<h4 align="right"><a href="README.md">English</a> | <strong>简体中文</strong> | <a href="README_JP.md">日本語</a></h4>
<p align="center">
    <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
</p>
<h1 align="center">Pake</h1>
<p align="center"><strong>一键打包网页生成轻量桌面应用，支持 macOS、Windows 和 Linux</strong></p>
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

## 特征

- 🎐 **体积小巧**：相比 Electron 应用小近 20 倍，通常只有 5M 左右
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
</table>

<details>

<summary>🏂 更多应用可去 <a href="https://github.com/tw93/Pake/releases">Release</a>下载，<b>此外点击可展开快捷键说明</b></summary>

<br/>

| Mac                         | Windows/Linux                  | 功能               |
| --------------------------- | ------------------------------ | ------------------ |
| <kbd>⌘</kbd> + <kbd>[</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> | 返回上一个页面     |
| <kbd>⌘</kbd> + <kbd>]</kbd> | <kbd>Ctrl</kbd> + <kbd>→</kbd> | 去下一个页面       |
| <kbd>⌘</kbd> + <kbd>↑</kbd> | <kbd>Ctrl</kbd> + <kbd>↑</kbd> | 自动滚动到页面顶部 |
| <kbd>⌘</kbd> + <kbd>↓</kbd> | <kbd>Ctrl</kbd> + <kbd>↓</kbd> | 自动滚动到页面底部 |
| <kbd>⌘</kbd> + <kbd>r</kbd> | <kbd>Ctrl</kbd> + <kbd>r</kbd> | 刷新页面           |
| <kbd>⌘</kbd> + <kbd>w</kbd> | <kbd>Ctrl</kbd> + <kbd>w</kbd> | 隐藏窗口，非退出   |
| <kbd>⌘</kbd> + <kbd>-</kbd> | <kbd>Ctrl</kbd> + <kbd>-</kbd> | 缩小页面           |
| <kbd>⌘</kbd> + <kbd>+</kbd> | <kbd>Ctrl</kbd> + <kbd>+</kbd> | 放大页面           |
| <kbd>⌘</kbd> + <kbd>=</kbd> | <kbd>Ctrl</kbd> + <kbd>=</kbd> | 放大页面           |
| <kbd>⌘</kbd> + <kbd>0</kbd> | <kbd>Ctrl</kbd> + <kbd>0</kbd> | 重置页面缩放       |

此外还支持双击头部全屏切换，拖拽头部移动窗口，Mac 用户支持手势返回和前进，有其他需求欢迎提出。

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

## 定制开发

需要 Rust `>=1.89` 和 Node `>=22`，详细安装指南参考 [Tauri 文档](https://tauri.app/start/prerequisites/)。不熟悉开发环境建议直接使用命令行工具。

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

## 支持

1. 我有两只猫，一只叫汤圆，一只可乐，假如 Pake 让你生活更美好，可以给她们 <a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">喂罐头 🥩</a>。
2. 如果你喜欢 Pake，可以在 Github Star，更欢迎 [推荐](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20一键打包网页生成轻量桌面应用，比%20Electron%20小%2020%20倍，支持%20macOS%20Windows%20Linux) 给志同道合的朋友使用。
3. 可以关注我的 [Twitter](https://twitter.com/HiTw93) 获取最新的 Pake 更新消息，也欢迎加入 [Telegram](https://t.me/+GclQS9ZnxyI2ODQ1) 聊天群。
4. 希望大伙玩的过程中有一种学习新技术的喜悦感，发现适合做成桌面 App 的网页也欢迎告诉我。
