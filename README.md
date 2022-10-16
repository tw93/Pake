# Pake

> 用 Rust 来打包你的 App，底层使用 Tauri，当前支持微信读书、Flomo、Vercel、Witeboard，有更多想法，欢迎提 Issue。

## 特征

🏂 **小**：相比传统的 electron 套壳打包，大小要小数十倍，一般 2M 大小  
😂 **快**：Pake 的底层使用的 Rust Tauri 框架，性能体验较 JS 框架要轻快不少  
🩴 **特**：不是单纯打包，实现了通用快捷键的透传、沉浸式的窗口、拖动、打包样式兼容  
🤱🏻 **玩**：只是一个玩具，或者说一个用 Rust 替代之前老思路的玩法，欢迎交流  

## 效果

### 微信读书

下载地址：<https://tw93.fun/images/app/WeRead.dmg>

![1](https://cdn.fliggy.com/upic/ffUmdj.png)

### Flomo

下载地址：<https://tw93.fun/images/app/Flomo.dmg>

![2](https://cdn.fliggy.com/upic/B49SAc.png)

### Vercel

下载地址：<https://tw93.fun/images/app/Vercel.dmg>

![3](https://cdn.fliggy.com/upic/CPVRnY.png)

### Witeboard

下载地址：<https://tw93.fun/images/app/Witeboard.dmg>

![4](https://gw.alipayobjects.com/zos/k/mq/SCR-20221016-uv9.png)

## 开发

开始前参考 [tauri](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-macos) 快速配置好环境

```sh
// 安装依赖
npm i

// 调试
npm run dev

// 打包
npm run build
```

## 打新包

1. 修改 `src-tauri` 目录下的 `tauri.conf.json` 中的 productName、icon、title、identifier 这 4 个字段，其中 icon 可以去 [macosicons](https://macosicons.com/#/) 下载并放到 `icons` 目录下即可
2. 修改 `src-tauri/src` 目录下的 `main.rs` 中的 with_url 字段为你需要打包网页的地址
3. npm run dev 本地调试看看效果，此外可以打开 `main.rs` 中 123、128 行 devtools 注释进行容器调试
4. npm run build 运行即可打包，假如有打开 devtools 模式，记得注释掉

## 高级

1. 如何改写样式，如去掉原站广告、不想要的模块、甚至重新设计？
   1. 首先需要打开 devtools 调试模式，找到你需要修改的样式名称，先在 devtools 里面验证效果
   2. 找到 `main.rs` 中 42 行左右地方，将需要覆盖的样式加上即可，有一些案例你可以模仿
   3. 正式打包前记得干掉 devtools 注释

2. 如何进行容器内的事件和 Pake 通信，比如说 Web 的拖拽、滚动、特殊点击传递啥的？
   1. 和上面1案例中准备工作一致
   2. 参考 `main.rs` 中 114 行左右位置，写好事件监听，然后用 `window.ipc.postMessage`将事件以及参数传递出来
   3. 然后参考 115 行左右，接收事件，自己处理即可，更多可以参考 tauri 以及 wry 的官方文档

## 最后

1. 希望大伙玩的过程中有一种学习新技术的喜悦感，如果有新点子欢迎告诉我
2. 假如你发现有很适合做成 Mac App 的网页也很欢迎告诉我，我给加到里面来
