# Pake

> 用 Rust 来打包你的 App，底层使用 Tauri，当前支持微信读书、Flomo，有更多想法，欢迎提 Issue。

## 下载

- <https://github.com/tw93/pake/releases>

## 效果

### 微信读书

![1](https://cdn.fliggy.com/upic/ffUmdj.png)

### Flomo

![2](https://cdn.fliggy.com/upic/B49SAc.png)

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
