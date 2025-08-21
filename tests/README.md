# Pake CLI Test Suite

这个目录包含了简化统一的 Pake CLI 工具测试套件。

## 快速开始

```bash
# 运行所有测试 (unit + integration + builder)
npm test

# 或者直接运行
node tests/index.js
```

## 测试结构

```tree
tests/
├── index.js      # 🎯 主测试运行器 (默认测试)
├── github.js     # 🔧 GitHub Actions 集成测试
├── build.js      # 🏗️ GitHub.com 构建测试
├── complete.js   # ✅ 完整端到端构建测试
├── config.js     # ⚙️ 测试配置
└── README.md     # 📖 说明文档
```

## 测试类别

### 1. 主测试套件 (`index.js`)

包含核心功能测试，通过 `npm test` 运行：

**单元测试 (Unit Tests)**

- ✅ 版本和帮助命令
- ✅ 参数和 URL 验证
- ✅ 数字参数验证
- ✅ 响应时间检查
- ✅ URL 可访问性

**集成测试 (Integration Tests)**

- ✅ 进程生成
- ✅ 文件系统权限
- ✅ 依赖解析

**构建测试 (Builder Tests)**

- ✅ 平台检测 (macOS/Windows/Linux)
- ✅ 架构检测
- ✅ 文件命名模式

### 2. GitHub Actions 测试 (`github.js`)

专门测试 GitHub Actions 集成功能：

- ✅ npm 包安装测试
- ✅ 环境变量模拟
- ✅ 配置清理逻辑
- ✅ 图标获取逻辑
- ✅ 平台特定构建检测
- ✅ 构建命令生成
- ✅ 工作流配置验证
- ✅ Rust 特性标志验证
- ✅ 配置验证逻辑
- ✅ GitHub.com 构建模拟
- ✅ 实际构建脚本测试

### 3. 快速构建测试 (`build.js`)

GitHub.com 专用快速构建验证：

- ✅ CLI 构建过程
- ✅ 配置生成
- ✅ 编译启动验证

### 4. 完整构建测试 (`complete.js`)

端到端的完整构建流程：

- ✅ GitHub.com 完整打包
- ✅ 应用包结构验证
- ✅ 构建阶段跟踪
- ✅ 文件生成验证

## 测试命令

| 命令                        | 描述                 | 覆盖范围                        | 持续时间    |
| --------------------------- | -------------------- | ------------------------------- | ----------- |
| `npm test`                  | **真实完整构建测试** | 完整 GitHub.com 应用打包        | **~8 分钟** |
| `node tests/index.js`       | 基础测试套件         | Unit + Integration + Builder    | ~30 秒      |
| `node tests/index.js --real-build` | 真实构建测试    | 完整 GitHub.com 应用打包        | ~8 分钟     |
| `node tests/github.js`      | GitHub Actions 测试  | 12 个 GitHub Actions 专项测试   | ~2 分钟     |
| `node tests/build.js`       | 快速构建测试         | GitHub.com 构建验证             | ~3 分钟     |
| `node tests/complete.js`    | 完整构建测试         | 端到端完整构建流程              | ~10 分钟    |

## 高级用法

```bash
# 运行特定测试类别
node tests/index.js --unit --integration     # 只运行单元和集成测试
node tests/index.js --builder                # 只运行构建测试
node tests/index.js --quick                  # 快速测试模式

# 运行专项测试
node tests/index.js --real-build             # 真实完整构建测试
node tests/index.js --pake-cli               # GitHub Actions 专项测试
node tests/index.js --e2e                    # 端到端测试

# 获取帮助
node tests/index.js --help
```

## 测试配置

测试使用 `config.js` 中的配置：

```javascript
export const TIMEOUTS = {
  QUICK: 3000, // 快速命令
  MEDIUM: 10000, // 验证测试
  LONG: 300000, // 构建测试
};

export const TEST_URLS = {
  GITHUB: "https://github.com",
  WEEKLY: "https://weekly.tw93.fun",
  VALID: "https://example.com",
  INVALID: "not://a/valid[url]",
};
```

## 手动测试场景

### 基础用法

```bash
# 测试基本应用创建
node dist/cli.js https://github.com --name "GitHub"

# 测试自定义尺寸
node dist/cli.js https://github.com --name "GitHub" --width 1200 --height 800

# 测试调试模式
node dist/cli.js https://github.com --name "DebugApp" --debug
```

### 高级功能

```bash
# 测试远程 CDN 图标
node dist/cli.js https://weekly.tw93.fun --name "Weekly" --icon "https://gw.alipayobjects.com/os/k/fw/weekly.icns"

# 测试注入文件
echo "body { background: #f0f0f0; }" > test.css
echo "console.log('injected');" > test.js
node dist/cli.js https://github.com --name "InjectionApp" --inject ./test.css,./test.js

# 测试全屏应用
node dist/cli.js https://github.com --name "FullGitHub" --fullscreen

# 测试系统托盘集成
node dist/cli.js https://github.com --name "TrayGitHub" --show-system-tray
```

### 平台特定 (macOS)

```bash
# 测试通用二进制
node dist/cli.js https://github.com --name "GitHub" --multi-arch

# 测试隐藏标题栏
node dist/cli.js https://github.com --name "ImmersiveGitHub" --hide-title-bar
```

## GitHub Actions 集成

项目使用简化的 GitHub Actions 工作流：

### 当前工作流：

- **`quality-and-test.yml`** - 运行所有测试、代码格式化和 Rust 质量检查
- **`claude-unified.yml`** - Claude AI 集成用于代码审查和协助
- **`release.yml`** - 处理发布、应用构建和 Docker 发布
- **`pake-cli.yaml`** - 手动 CLI 构建工作流
- **`pake_build_single_app.yaml`** - 可重用的单应用构建工作流

### 集成示例：

```yaml
# 推送/PR 时自动测试
- name: Run Quality & Tests
  run: npm test

# 手动 CLI 构建
- name: Build CLI
  run: npm run cli:build
```

## 故障排除

### 常见问题

1. **"CLI file not found"**

   ```bash
   npm run cli:build
   ```

2. **"Permission denied"**

   ```bash
   chmod +x tests/index.js
   ```

3. **"Timeout errors"**
   - 在 `config.js` 中增加超时时间
   - 检查系统资源

### 调试模式

使用调试输出运行测试：

```bash
DEBUG=1 npm test
# 或
CI=1 node tests/index.js --quick
```

## 性能预期

| 平台      | 首次构建 | 后续构建 | 内存使用 |
| --------- | -------- | -------- | -------- |
| M1 Mac    | 2-3 分钟 | 30-45秒  | ~200MB   |
| Intel Mac | 3-4 分钟 | 45-60秒  | ~250MB   |
| Linux     | 4-5 分钟 | 60-90秒  | ~300MB   |
| Windows   | 5-6 分钟 | 90-120秒 | ~350MB   |

## 添加新测试

### 在主测试套件中添加单元测试

```javascript
// 在 index.js 的 runUnitTests() 方法中
await this.runTest(
  "我的新测试",
  () => {
    // 测试逻辑
    return true; // 或 false
  },
  TIMEOUTS.QUICK,
);
```

### 添加 GitHub Actions 测试

```javascript
// 在 github.js 中
runner.addTest(
  "我的 GitHub Actions 测试",
  async () => {
    // 异步测试逻辑
    return await someAsyncOperation();
  },
  TIMEOUTS.MEDIUM,
  "测试描述",
);
```

## 贡献指南

添加新功能时：

1. 为新功能添加单元测试
2. 为新工作流添加集成测试
3. 更新手动测试场景
4. 提交前运行完整测试套件

```bash
# 提交前测试流程
npm run cli:build
npm test
node tests/github.js    # 可选：GitHub Actions 测试
node tests/complete.js  # 可选：完整构建测试
```

## 测试覆盖

- **单元测试**: 12 个核心功能测试
- **GitHub Actions**: 12 个专项集成测试
- **构建验证**: 完整的端到端构建流程测试
- **平台支持**: macOS, Windows, Linux
- **架构支持**: Intel, ARM64, Universal (macOS)

通过 `npm test` 可快速验证核心功能，专项测试可按需运行以验证特定场景。
