# PakePro
## 项目介绍 Project introduction
一个超级简单,基于 [Pake](https://github.com/tw93/Pake/#) 项目改造的将前端项目打包成桌面端的工具.
A super simple, based on [Pake](https://github.com/tw93/Pake/#) project that can package front-end projects into desktop applications.

这个项目每次打开新的页面,都会创建一个新的窗口.(如果前端逻辑是路由跳转,则不会创建新的窗口)
This project will create a new window each time it opens a new page. (If the front-end logic is route jump, it will not create a new window)

```sh
# 安装依赖
# Install dependencies
npm i

# 本地开发 默认运行本地 http://localhost:8080 的前端项目.
# Local development defaults to running locally http://localhost:8080 The front-end project.
npm run dev

# 将前端项目打包到 dist 目录 , 并将 dist 目录复制到 PakePro 项目的 src 目录.
# Package the front-end project into the dist directory and copy the dist directory to the src directory of the PakePro project.
npm run build
```

## 项目修改 Project modification

1. /Users/jia/Documents/GitHub/Pake/src-tauri/src/app/invoke.rs
  window_run_label 函数是每次创建新窗口的主要逻辑.
  The window_run_label function is the main logic for creating a new window each time.

2. /Users/jia/Documents/GitHub/Pake/src-tauri/src/inject/event.js
  你可以通过修改 window.open 去自定义创建新窗口的逻辑.
  You can modify window.open to customize the logic for creating a new window.
  
3. /Users/jia/Documents/GitHub/Pake/src-tauri/src/lib.rs
  项目采用的是 tauri_plugin_localhost 插件, http://localhost:9527 提供的本地服务器, tauri:// 协议会导致一些服务无法使用, 你们可以根据自己的需求修改这里的逻辑.
  The project uses the tauri_plugin_localhost plugin, which provides a local server at http://localhost:9527. The tauri:// protocol will cause some services to not work, so you can modify the logic here according to your own needs.

## ⚠️注意安全
  /Users/jia/Documents/GitHub/Pake/src-tauri/capabilities/default.json
  为了方便使用, 安全权限采用的是最宽松的, 你可以根据自己的需求修改这里的逻辑.
  To facilitate use, the security permissions are set to the most relaxed. You can modify the logic here according to your own needs.

