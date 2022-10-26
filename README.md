<p align="right"><strong>中文</strong> | <a href="https://github.com/tw93/Pake/blob/master/README_EN.md">English</a></p>
<p align="center">
  <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
  <h1 align="center">Pake</h1>
  <div align="left">很简单的用 Rust 打包网页生成很小的 Mac App，底层使用 Tauri，支持微信读书、Flomo、RunCode、<a href="https://witeboard.com/">Witeboard</a>、ToolsFun、Vercel、即刻、RoamResearch 等，详细小白开发教程可见底部。</div>
</p>

## 特征

🏂 **小**：相比传统的 Electron 套壳打包，大小要小将近 50 倍，一般不到 2M ([数据](https://static.tw93.fun/img/pakedata.png))  
😂 **快**：Pake 的底层使用的 Rust Tauri 框架，性能体验较 JS 框架要轻快不少，内存小很多  
🩴 **特**：不是单纯打包，实现了通用快捷键的透传、沉浸式的窗口、拖动、打包样式兼容  
🐶 **玩**：只是一个很简单的小玩具，用 Rust 替代之前套壳网页老的思路玩法，PWA 也很好，友好交流勿喷

## 快捷键

1. `command + ]`：返回上一个页面
2. `command + [`：去下一个页面，假如有的话
3. `command + ↑`：自动滚动到页面顶部
4. `command + ↓`：自动滚动到页面底部
5. `command + r`：刷新页面
6. `command + w`：隐藏窗口，非退出
7. `command + -`：缩小页面
8. `command + =`：放大页面
9. `command + 0`：重置页面缩放

此外还支持双击头部进行全屏切换，拖拽头部进行移动窗口，还有其他需求，欢迎提过来。

## 效果

<table>
    <tr>
        <td>WeRead <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead.dmg">Download</a></td>
        <td>Flomo <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/ffUmdj.png width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/B49SAc.png width=600/></td>
    </tr>
    <tr>
        <td>RunCode <a href="https://github.com/tw93/Pake/releases/latest/download/RunCode.dmg">Download</a></td>
        <td><a href="https://witeboard.com/">Witeboard</a> <a href="https://github.com/tw93/Pake/releases/latest/download/Witeboard.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://gw.alipayobjects.com/zos/k/qc/SCR-20221018-fmj.png width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/o5QY4c.png width=600/></td>
    </tr>
    <tr>
        <td>ToolsFun <a href="https://github.com/tw93/Pake/releases/latest/download/Tools.dmg">Download</a></td>
        <td>Vercel <a href="https://github.com/tw93/Pake/releases/latest/download/Vercel.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/jVCiL0.png width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/CPVRnY.png width=600/></td>
    </tr>
</table>

更多常用 App 下载可以去 [Release](https://github.com/tw93/Pake/releases) 中看看。

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
3. `npm run dev` 本地调试看看效果，此外可以打开 `main.rs` 中 devtools 两处注释（搜索 `_devtools`）进行容器调试
4. `npm run build` 运行即可打包，假如有打开 devtools 模式，记得注释掉

## 高级

#### 如何改写样式，如去掉原站广告、不想要的模块、甚至重新设计？

1. 首先需要打开 devtools 调试模式，找到你需要修改的样式名称，先在 devtools 里面验证效果
2. 找到 `pake.js` 中样式位置（搜索 `style.innerHTML`），将需要覆盖的样式加上即可，有一些案例你可以模仿
3. 正式打包前记得干掉 devtools 注释

#### 如何注入 JS 的逻辑，比如实现事件监听，比如说键盘快捷键？

1. 和上面1案例中准备工作一致
2. 参考 `pake.js` 中事件监听（搜索`document.addEventListener`）,直接编写即可，这里更多是基础前端的技术

#### 如何进行容器内的事件和 Pake 通信，比如说 Web 的拖拽、滚动、特殊点击传递啥的？

1. 和上面1案例中准备工作一致
2. 参考 `pake.js` 中通信代码（搜索 `postMessage`），写好事件监听，然后用 `window.ipc.postMessage`将事件以及参数传递出来
3. 然后参考容器接收事件（搜索 `window.drag_window`），自己处理即可，更多可以参考 tauri 以及 wry 的官方文档

## 贡献者

<a href="https://github.com/tw93/pake/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tw93/pake" />
</a>

## 最后

1. 希望大伙玩的过程中有一种学习新技术的喜悦感，如果有新点子欢迎告诉我
2. 假如你发现有很适合做成 Mac App 的网页也很欢迎告诉我，我给加到里面来
