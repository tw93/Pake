<p align="left"><strong>中文</strong> | <a href="https://github.com/tw93/Pake/blob/master/README_EN.md">English</a></p>
<p align="center">
  <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
  <h1 align="center">Pake</h1>
  <div align="left">很简单的用 Rust 打包网页生成很小的 Mac App，底层使用 Tauri，支持微信读书、Twitter、Youtube、Reference、RunCode、Witeboard、Flomo、语雀、Vercel、V2EX、工具箱等，详细小白开发教程可见底部。</div>
</p>

## 特征

🏂 **小**：相比传统的 Electron 套壳打包，大小要小将近 40 倍，一般不到 3M ([数据](https://static.tw93.fun/img/pakedata.png))  
😂 **快**：Pake 的底层使用的 Rust Tauri 框架，性能体验较 JS 框架要轻快不少，内存小很多  
🩴 **特**：不是单纯打包，实现了通用快捷键的透传、沉浸式的窗口、拖动、样式改写简化  
🐶 **玩**：只是一个很简单的小玩具，用 Rust 替代之前套壳网页老的思路玩法，PWA 也很好，友好交流勿喷

## 下载

<table>
    <tr>
        <td>WeRead <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead.dmg">Download</a></td>
        <td>Twitter <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/17dC9I.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/mc41xq.jpg width=600/></td>
    </tr>
    <tr>
        <td>YouTube <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube.dmg">Download</a></td>
        <td>Reference <a href="https://github.com/tw93/Pake/releases/latest/download/Reference.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/Ea5ZRw.png width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/KFsZIY.png width=600/></td>
    </tr>
    <tr>
        <td>RunCode <a href="https://github.com/tw93/Pake/releases/latest/download/RunCode.dmg">Download</a></td>
        <td>Witeboard <a href="https://github.com/tw93/Pake/releases/latest/download/Witeboard.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/EB1OYP.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/CW0p3q.jpg width=600/></td>
    </tr>
    <tr>
        <td>Flomo <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo.dmg">Download</a></td>
        <td>YuQue <a href="https://github.com/tw93/Pake/releases/latest/download/YuQue.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/jg9Eeu.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/RwmWtV.jpg width=600/></td>
    </tr>
</table>

更多常用 App 下载可以去 [Release](https://github.com/tw93/Pake/releases) 中看看。

## 快捷键

1. `command + [`：返回上一个页面
2. `command + ]`：去下一个页面
3. `command + ↑`：自动滚动到页面顶部
4. `command + ↓`：自动滚动到页面底部
5. `command + r`：刷新页面
6. `command + w`：隐藏窗口，非退出
7. `command + -`：缩小页面
8. `command + =`：放大页面
9. `command + 0`：重置页面缩放

此外还支持双击头部进行全屏切换，拖拽头部进行移动窗口，还有其他需求，欢迎提过来。

## 开发

开始前参考 [Tauri](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-macos) 快速配置好环境，如果你想打包 Windows、Linux 系统的包，可以参考 [Building](https://tauri.app/v1/guides/building/) 文档

```sh
// 安装依赖
npm i

// 调试
npm run dev

// 打包
npm run build
```

## 打新包

1. 修改 `src-tauri` 目录下的 `tauri.conf.json` 中的 `url、productName、icon、title、identifier` 这 5 个字段，其中 icon 可以从 icons 目录选择一个，也可以去 [macOSicons](https://macosicons.com/#/) 下载符合产品名称的
2. 关于窗口属性设置，可以在 `tauri.conf.json` 修改 `windows` 属性对应的 `width/height`，是否全屏 `fullscreen`，是否可以调整大小 `resizable`，假如你不好适配沉浸式头部，可以将 `transparent` 设置成 `true` 即可。
3. `npm run dev` 本地调试看看效果，此外可以打开 `main.rs` 中两处注释 `_devtools` 进行容器调试
4. `npm run build` 运行即可打包，假如有打开 devtools 模式，记得注释掉

## 高级

#### 1. 如何改写样式，如去掉原站广告、不想要的模块、甚至重新设计？

首先需要打开 devtools 调试模式，找到你需要修改的样式名称，先在 devtools 里面验证效果；找到 `pake.js` 中样式位置 `style.innerHTML` ，将需要覆盖的样式加上即可，有一些案例你可以模仿，正式打包前记得干掉 devtools 注释。

#### 2. 如何注入 JS 的逻辑，比如实现事件监听，比如说键盘快捷键？

参考 `pake.js` 中事件监听 `document.addEventListener`，直接编写即可，这里更多是基础前端的技术。

#### 3. 如何进行容器内的事件和 Pake 通信，比如说 Web 的拖拽、滚动、特殊点击传递啥的？

参考 `pake.js` 中通信代码 `postMessage`，写好事件监听，然后用 `window.ipc.postMessage` 将事件以及参数传递出来，然后参考容器接收事件 `window.drag_window`，自己处理即可，更多可以参考 tauri 以及 wry 的官方文档。

## 贡献者

<!-- readme: contributors -start -->
<table>
<tr>
    <td align="center">
        <a href="https://github.com/tw93">
            <img src="https://avatars.githubusercontent.com/u/8736212?v=4" width="90;" alt="tw93"/>
            <br />
            <sub><b>Tw93</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/liby">
            <img src="https://avatars.githubusercontent.com/u/38807139?v=4" width="90;" alt="liby"/>
            <br />
            <sub><b>Bryan Lee</b></sub>
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
        <a href="https://github.com/2nthony">
            <img src="https://avatars.githubusercontent.com/u/19513289?v=4" width="90;" alt="2nthony"/>
            <br />
            <sub><b>2nthony</b></sub>
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
        <a href="https://github.com/houhoz">
            <img src="https://avatars.githubusercontent.com/u/19684376?v=4" width="90;" alt="houhoz"/>
            <br />
            <sub><b>Hyzhao</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/liusishan">
            <img src="https://avatars.githubusercontent.com/u/33129823?v=4" width="90;" alt="liusishan"/>
            <br />
            <sub><b>Null</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/piaoyidage">
            <img src="https://avatars.githubusercontent.com/u/5135405?v=4" width="90;" alt="piaoyidage"/>
            <br />
            <sub><b>Ranger</b></sub>
        </a>
    </td></tr>
</table>
<!-- readme: contributors -end -->

## 支持

- 我有两只猫，一只叫汤圆，一只叫可乐，假如觉得 Pake 让你生活更美好，可以给汤圆可乐 <a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">喂罐头 🥩🍤</a>。
- 如果你喜欢 Pake，可以在 Github Star，更欢迎 [推荐](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20%E4%B8%80%E4%B8%AA%E5%BE%88%E7%AE%80%E5%8D%95%E7%9A%84%E7%94%A8%20Rust%20%E6%89%93%E5%8C%85%E7%BD%91%E9%A1%B5%E7%94%9F%E6%88%90%20Mac%20App%20%E7%9A%84%E5%B7%A5%E5%85%B7%EF%BC%8C%E7%9B%B8%E6%AF%94%E4%BC%A0%E7%BB%9F%E7%9A%84%20Electron%20%E5%A5%97%E5%A3%B3%E6%89%93%E5%8C%85%EF%BC%8C%E5%A4%A7%E5%B0%8F%E8%A6%81%E5%B0%8F%E5%B0%86%E8%BF%91%2040%20%E5%80%8D%EF%BC%8C%E4%B8%80%E8%88%AC%202M%20%E5%B7%A6%E5%8F%B3%EF%BC%8C%E5%BA%95%E5%B1%82%E4%BD%BF%E7%94%A8Tauri%20%EF%BC%8C%E6%80%A7%E8%83%BD%E4%BD%93%E9%AA%8C%E8%BE%83%20JS%20%E6%A1%86%E6%9E%B6%E8%A6%81%E8%BD%BB%E5%BF%AB%E4%B8%8D%E5%B0%91%EF%BC%8C%E5%86%85%E5%AD%98%E5%B0%8F%E5%BE%88%E5%A4%9A%EF%BC%8C%E6%94%AF%E6%8C%81%E5%BE%AE%E4%BF%A1%E8%AF%BB%E4%B9%A6%E3%80%81Twitter%E3%80%81Youtube%E3%80%81RunCode%E3%80%81Flomo%E3%80%81%E8%AF%AD%E9%9B%80%E7%AD%89%EF%BC%8C%E5%8F%AF%E4%BB%A5%E5%BE%88%E6%96%B9%E4%BE%BF%E4%BA%8C%E6%AC%A1%E5%BC%80%E5%8F%91~) 给你志同道合的朋友使用。
- 可以关注我的 [Twitter](https://twitter.com/HiTw93) 获取到最新的 Pake 更新消息，也欢迎加入 [Telegram](https://t.me/miaoyan) 聊天群。

## 最后

1. 希望大伙玩的过程中有一种学习新技术的喜悦感，如果有新点子欢迎告诉我
2. 假如你发现有很适合做成 Mac App 的网页也很欢迎告诉我，我给加到里面来
