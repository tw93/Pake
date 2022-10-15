# Pake

> 用 Rust 来打包你的 App，底层使用 Tauri，当前支持微信读书、Flomo，有更多想法，欢迎提 Issue。

## 下载地址

- <https://github.com/tw93/pake/releases>

## 展示效果

### 微信读书

![1](https://cdn.fliggy.com/upic/ffUmdj.png)

### Flomo

![2](https://cdn.fliggy.com/upic/B49SAc.png)

## 开发步骤

```shell
// 开始前参考 https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-macos 配置环境
// 安装依赖
npm i

//本地调试
npm run dev

//打包app
npm run build
```

## 打一个新的包

1. 修改 src-tauri 目录下的 tauri.conf.json 中的 productName、icon、title、identifier 这4个字段
2. 修改 src-tauri src 目录下的 main.rs 中的 with_url 字段为你需要打包网页的地址
3. npm run build 即可
