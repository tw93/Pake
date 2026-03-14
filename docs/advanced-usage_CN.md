# 高级用法

<h4 align="right"><strong><a href="advanced-usage.md">English</a></strong> | 简体中文</h4>

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

## 内置功能

### 下载错误通知

Pake 自动提供用户友好的下载错误通知：

**功能特性：**

- **双语支持**：自动检测浏览器语言（中文/英文）
- **系统通知**：在授予权限后使用原生操作系统通知
- **优雅降级**：如果通知不可用则降级到控制台日志
- **全面覆盖**：处理所有下载类型（HTTP、Data URI、Blob）

**用户体验：**

当下载失败时，用户将看到通知：

- 英文："Download Error - Download failed: filename.pdf"
- 中文："下载错误 - 下载失败: filename.pdf"

**请求通知权限：**

要启用通知，请在注入的 JavaScript 中添加：

```javascript
// 在应用启动时请求通知权限
if (window.Notification && Notification.permission === "default") {
  Notification.requestPermission();
}
```

下载系统自动处理：

- 常规 HTTP(S) 下载
- Data URI 下载（base64 编码文件）
- Blob URL 下载（动态生成的文件）
- 右键菜单发起的下载

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

## macOS 摄像头与麦克风权限

Pake 构建的应用默认不申请摄像头或麦克风权限。对于需要这些权限的站点（例如视频会议或语音输入），在构建时传入对应的标志：

```bash
pake https://chatgpt.com --name ChatGPT --microphone
pake https://meet.google.com --name GoogleMeet --camera --microphone
```

- `--microphone` — 申请麦克风权限（`com.apple.security.device.audio-input`）
- `--camera` — 申请摄像头权限（`com.apple.security.device.camera`）

macOS 会在首次使用时向用户弹出权限确认对话框。请仅在确实需要的站点上添加这些标志。

## 同一站点生成多个独立应用

如果你需要为同一个站点生成多个彼此独立的应用，例如两个不同登录态的 Gmail，可以直接使用不同的应用名称进行构建：

```bash
pake https://gmail.com --name "Gmail Work"
pake https://gmail.com --name "Gmail Personal"
```

Pake 现在会基于 `URL + name` 生成不同的应用标识，因此这两个应用会被当作两个独立桌面应用安装，而不是落到同一个应用上。

对于需要固定 bundle identifier 的高级场景，Pake 也支持一个隐藏参数 `--identifier`：

```bash
pake https://gmail.com --name "Gmail Work" --identifier com.example.gmail.work
```

`--multi-instance` 和这个能力不同，它只是允许同一个已打包应用启动多个进程，并不会创建多个独立应用身份。

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

- Node.js ≥22.0.0 (推荐 LTS，较旧版本 ≥18.0.0 可能可用)
- Rust ≥1.85.0 (推荐稳定版)

#### 平台特定要求

**macOS:**

- Xcode 命令行工具：`xcode-select --install`

**Windows:**

- **重要**：请先参阅 [Tauri 依赖项指南](https://v2.tauri.app/start/prerequisites/)
- Windows 10 SDK (10.0.19041.0) 和 Visual Studio Build Tools 2022 (≥17.2)
- 必需的运行库：
  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86)（可选）
  4. Microsoft Visual C++ 2013 Redistributable (x86)（可选）
  5. Microsoft Visual C++ 2008 Redistributable (x86)（可选）

- **Windows ARM (ARM64) 支持**：在 Visual Studio Installer 中的"单个组件"下安装"MSVC v143 - VS 2022 C++ ARM64 构建工具"

**Linux (Ubuntu):**

```bash
sudo apt install libdbus-1-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    gnome-video-effects \
    gnome-video-effects-extra \
    libglib2.0-dev \
    pkg-config
```

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

#### 命令参考

- **开发模式**：`pnpm run dev`（热重载）
- **构建**：`pnpm run build`
- **调试构建**：`pnpm run build:debug`
- **CLI 构建**：`pnpm run cli:build`

#### CLI 开发调试

对于需要热重载的 CLI 开发，可修改 `bin/defaults.ts` 中的 `DEFAULT_DEV_PAKE_OPTIONS` 配置：

```typescript
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: "https://weekly.tw93.fun/en",
  name: "Weekly",
};
```

然后运行：

```bash
pnpm run cli:dev
```

此脚本会读取上述配置并使用 watch 模式打包指定的应用，对 `pake-cli` 代码修改可实时热更新。

### 测试指南

统一的 CLI 构建与发布验证指南，用于验证多平台打包功能。

#### 运行测试

```bash
# 完整测试套件（推荐）
pnpm test                   # 构建 CLI，运行 Vitest 套件，再执行真实构建和发布流程 smoke test

# 跳过真实构建和发布流程 smoke test
pnpm test -- --no-build

# 仅运行快速 Vitest 套件
npx vitest run

# 构建 CLI 以供测试
pnpm run cli:build

# 单独运行发布流程 smoke test
node ./tests/release.js
```

#### 🚀 完整测试套件包含

- ✅ **Vitest 套件**：单元、集成、构建器和 CLI 选项覆盖
- ✅ **真实构建 smoke test**：按平台验证实际打包流程
- ✅ **发布流程 smoke test**：验证 popular apps 的发布构建路径

#### 测试内容详情

- `pnpm test` 会运行 [`tests/index.js`](../tests/index.js) 这个主测试入口，它会：
- 先构建 CLI，
- 再运行 Vitest 套件，
- 如果没有传 `--no-build`，继续执行真实构建 smoke test，
- 然后在真实构建成功后继续执行发布流程 smoke test。

常用可选参数：

- `--no-unit`：跳过单元测试
- `--no-integration`：跳过集成测试
- `--no-builder`：跳过构建器测试
- `--no-build`：跳过真实构建 smoke test 以及后续的发布流程 smoke test
- `--e2e`：增加端到端配置测试
- `--pake-cli`：增加 GitHub Actions 相关检查

如果只想单独验证发布流程，可以直接运行 `node ./tests/release.js`。

#### 故障排除

- **CLI 文件不存在**：运行 `pnpm run cli:build`
- **测试超时**：构建测试需要较长时间完成
- **构建失败**：检查 Rust 工具链 `rustup update`
- **权限错误**：确保有写入权限

### 常见构建问题

- **Rust 编译错误**: 在 `src-tauri/` 目录中运行 `cargo clean`
- **Node 依赖问题**: 删除 `node_modules` 并运行 `pnpm install`
- **macOS 权限错误**: 运行 `sudo xcode-select --reset`

## 链接

- [CLI 文档](cli-usage_CN.md)
- [GitHub 讨论区](https://github.com/tw93/Pake/discussions)
