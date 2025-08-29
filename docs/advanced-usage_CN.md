# 高级用法

通过样式修改、JavaScript 注入和容器通信等方式自定义 Pake 应用。

## 样式自定义

通过修改 CSS 移除广告或自定义外观。

**快速流程：**

1. 运行 `pnpm run dev` 进入开发模式
2. 使用开发者工具找到要修改的元素
3. 编辑 `src-tauri/src/inject/style.js`：

```javascript
const css = `
  .ads-banner { display: none !important; }
  .header { background: #1a1a1a !important; }
`;
```

## JavaScript 注入

添加自定义功能，如键盘快捷键。

**实现方式：**

1. 编辑 `src-tauri/src/inject/event.js`
2. 添加事件监听器：

```javascript
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "k") {
    // 自定义操作
  }
});
```

## 容器通信

在网页内容和 Pake 容器之间发送消息。

**网页端（JavaScript）：**

```javascript
window.__TAURI__.invoke("handle_scroll", {
  scrollY: window.scrollY,
  scrollX: window.scrollX,
});
```

**容器端（Rust）：**

```rust
#[tauri::command]
fn handle_scroll(scroll_y: f64, scroll_x: f64) {
  println!("滚动位置: {}, {}", scroll_x, scroll_y);
}
```

## 窗口配置

在 `pake.json` 中配置窗口属性：

```json
{
  "windows": {
    "width": 1200,
    "height": 780,
    "fullscreen": false,
    "resizable": true
  },
  "hideTitleBar": true
}
```

## 静态文件打包

打包本地 HTML/CSS/JS 文件：

```bash
pake ./my-app/index.html --name my-static-app --use-local-file
```

要求：Pake CLI >= 3.0.0

## 项目结构

了解 Pake 的代码库结构将帮助您有效地进行导航和贡献：

```tree
├── bin/                    # CLI 源代码 (TypeScript)
│   ├── builders/          # 平台特定的构建器
│   ├── helpers/           # 实用函数
│   └── options/           # CLI 选项处理
├── docs/                  # 项目文档
├── src-tauri/             # Tauri 应用核心
│   ├── src/
│   │   ├── app/           # 核心模块（窗口、托盘、快捷键）
│   │   ├── inject/        # 网页注入逻辑
│   │   └── lib.rs         # 应用程序入口点
│   ├── icons/             # macOS 图标 (.icns)
│   ├── png/               # Windows/Linux 图标 (.ico, .png)
│   ├── pake.json          # 应用配置
│   └── tauri.*.conf.json  # 平台特定配置
├── scripts/               # 构建和实用脚本
└── tests/                 # 测试套件
```

### 关键组件

- **CLI 工具** (`bin/`): 基于 TypeScript 的命令接口，用于打包应用
- **Tauri 应用** (`src-tauri/`): 基于 Rust 的桌面框架
- **注入系统** (`src-tauri/src/inject/`): 用于网页的自定义 CSS/JS 注入
- **配置**: 多平台应用设置和构建配置

## 开发工作流

### 前置条件

- Node.js ≥22.0.0 (推荐 LTS，较旧版本 ≥16.0.0 可能可用)
- Rust ≥1.89.0 (推荐稳定版，较旧版本 ≥1.78.0 可能可用)
- 平台特定构建工具:
  - **macOS**: Xcode 命令行工具 (`xcode-select --install`)
  - **Windows**: Visual Studio 构建工具与 MSVC
  - **Linux**: `build-essential`、`libwebkit2gtk`、系统依赖

### 安装

```bash
# 克隆仓库
git clone https://github.com/tw93/Pake.git
cd Pake

# 安装依赖
pnpm install

# 开始开发
pnpm run dev
```

### 开发命令

1. **CLI 更改**: 编辑 `bin/` 中的文件，然后运行 `pnpm run cli:build`
2. **核心应用更改**: 编辑 `src-tauri/src/` 中的文件，然后运行 `pnpm run dev`
3. **注入逻辑**: 修改 `src-tauri/src/inject/` 中的文件以进行网页自定义
4. **测试**: 运行 `pnpm test` 进行综合验证

- **开发模式**：`pnpm run dev`（热重载）
- **构建**：`pnpm run build`
- **调试构建**：`pnpm run build:debug`
- **CLI 构建**：`pnpm run cli:build`

### 测试

```bash
# 运行所有测试（单元 + 集成 + 构建器）
pnpm test

# 构建 CLI 以供测试
pnpm run cli:build
```

### 常见构建问题

- **Rust 编译错误**: 在 `src-tauri/` 目录中运行 `cargo clean`
- **Node 依赖问题**: 删除 `node_modules` 并运行 `pnpm install`
- **macOS 权限错误**: 运行 `sudo xcode-select --reset`

## 链接

- [CLI 文档](cli-usage_CN.md)
- [CLI 测试指南](cli-testing.md)
- [GitHub 讨论区](https://github.com/tw93/Pake/discussions)
