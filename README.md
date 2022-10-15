# Pake

> 用 Rust 来打包你的 App，底层使用 Tauri，当前支持微信读书、Flomo、Vercel，有更多想法，欢迎提 Issue。

下载地址: <https://github.com/tw93/pake/releases>

## 特征

🏂 **小**：相比传统的 electron 套壳打包，大小要小数十倍，一般 2M 大小
😂 **快**：Pake 的底层使用的 Rust Tauri 框架，性能体验较 JS 框架要轻快不少
🩴 **特**：不是单纯打包，实现了通用快捷键的透传、沉浸式的窗口、拖动、打包样式兼容
🤱🏻 **玩**：只是一个玩具，或者说一个用 Rust 替代之前老思路的玩法，欢迎交流

## 效果

### 微🤱🏻信读书

![1](https://cdn.fliggy.com/upic/ffUmdj.png)

### Flomo

![2](https://cdn.fliggy.com/upic/B49SAc.png)

### Vercel

![3](https://cdn.fliggy.com/upic/CPVRnY.png)

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
3. npm run dev 本地调试看看效果，此外可以打开 `main.rs` 中 111、116 行注释进行容器调试
4. npm run build 运行即可打包
