# PakePro
## 项目介绍 Project introduction
一个超级简单,基于 [Pake](https://github.com/tw93/Pake/#) 项目改造的将前端项目打包成桌面端的工具. <br>
A super simple, based on [Pake](https://github.com/tw93/Pake/#) project that can package front-end projects into desktop applications.

这个项目每次打开新的页面,都会创建一个新的窗口.(如果前端逻辑是路由跳转,则不会创建新的窗口) <br>
This project will create a new window each time it opens a new page. (If the front-end logic is route jump, it will not create a new window)

注意: 本地运行时,你需要 `http://localhost:8080` 运行自己的前端项目. 打包部署时,你需要将 `dist` 目录复制到 PakePro 项目的 根目录. <br>
Note: When running locally, you need to run your own front-end project at `http://localhost:8080`. When deploying, you need to copy the `dist` directory to the root directory of the PakePro project. <br>

```sh
# 安装依赖
# Install dependencies
npm i

# 本地开发 默认运行本地 http://localhost:8080 的前端项目.
# Local development defaults to running locally http://localhost:8080 The front-end project.
npm run dev

# 将前端项目打包到 dist 目录 , 并将 dist 目录复制到 PakePro 项目的 根目录.
# Package the front-end project into the dist directory and copy the dist directory to the root directory of the PakePro project.
npm run tauri build -- --target x86_64-pc-windows-msvc
npm run tauri build -- --target universal-apple-darwin  
```

## 项目修改 Project modification

1. PakePro/src-tauri/src/app/invoke.rs <br>
  window_run_label 函数是每次创建新窗口的主要逻辑. <br>
  The window_run_label function is the main logic for creating a new window each time. <br>

2. PakePro/src-tauri/src/inject/event.js <br>
  你可以通过修改 window.open 去自定义创建新窗口的逻辑. <br>
  You can modify window.open to customize the logic for creating a new window. <br>
  
3. PakePro/src-tauri/src/lib.rs <br>
  项目采用的是 tauri_plugin_localhost 插件, `http://localhost:9527` 提供的本地服务器, `tauri://` 协议会导致一些服务无法使用, 你们可以根据自己的需求修改这里的逻辑. <br>
  The project uses the tauri_plugin_localhost plugin, which provides a local server at `http://localhost:9527`. The `tauri://` protocol will cause some services to not work, so you can modify the logic here according to your own needs. <br>

## ⚠️ 注意安全 Caution!
  PakePro/src-tauri/capabilities/default.json <br>
  为了方便使用, 安全权限采用的是最宽松的, 你可以根据自己的需求修改这里的逻辑. <br>
  To facilitate use, the security permissions are set to the most relaxed. You can modify the logic here according to your own needs.

## Support [GoViewPro](https://ai.goviewlink.com/saas/)
