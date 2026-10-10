# Pake Action

<div align="center">

[English](pake-action.md) · **中文**

</div>

在自己项目的 GitHub Actions 工作流里调用 Pake，一步把任何网页打包为轻量桌面应用，只想在线打包、不写工作流的话，看 [GitHub Actions 在线构建指南](github-actions-usage_CN.md)。

## 快速开始

```yaml
- name: Build Pake App
  uses: tw93/Pake@V3.17.3
  with:
    url: "https://example.com"
    name: "MyApp"
```

## 输入参数

| 参数         | 说明                     | 必填 | 默认值  |
| :----------- | :----------------------- | :--- | :------ |
| `url`        | 打包目标网页地址         | 是   |         |
| `name`       | 应用程序名称             | 是   |         |
| `output-dir` | 产物输出目录             | 否   | `dist`  |
| `icon`       | 自定义应用图标路径或 URL | 否   |         |
| `width`      | 窗口初始宽度             | 否   | `1200`  |
| `height`     | 窗口初始高度             | 否   | `780`   |
| `debug`      | 开启调试模式输出详细日志 | 否   | `false` |

## 输出参数

| 输出项         | 说明                 |
| :------------- | :------------------- |
| `package-path` | 生成的应用安装包路径 |

## 使用示例

### 基础用法

```yaml
name: Build Web App
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tw93/Pake@V3.17.3
        with:
          url: "https://weekly.tw93.fun"
          name: "WeeklyApp"
```

### 指定自定义图标和窗口尺寸

```yaml
- uses: tw93/Pake@V3.17.3
  with:
    url: "https://example.com"
    name: "MyApp"
    icon: "https://example.com/icon.png"
    width: 1400
    height: 900
```

### 多平台矩阵构建

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: tw93/Pake@V3.17.3
        with:
          url: "https://example.com"
          name: "CrossPlatformApp"
```

## 执行流程

1. **环境准备**：安装 Node.js 依赖并构建 Pake CLI，缺少 Rust 时自动安装
2. **构建应用**：解析参数调用 Pake CLI 完成本地编译打包
3. **整理产物**：查找构建完成的安装包并归档至指定输出目录

## 支持平台

- **Linux**：`.deb` 安装包（Ubuntu 运行器）
- **macOS**：`.app` 应用（macOS 运行器）
- **Windows**：`.msi` 或 `.exe`（Windows 运行器）

每次运行只把找到的第一个安装包移到输出目录并写入 `package-path`，可结合 GitHub Actions 的 `matrix` 策略并发构建全平台安装包。

## 相关文档

- [GitHub Actions 在线构建指南](github-actions-usage_CN.md)：通过 Fork 仓库免本地环境打包
- [CLI 使用指南](cli-usage_CN.md)：Pake 命令行完整参数与高级用法
- [高级用法指南](advanced-usage_CN.md)：代码定制与脚本注入
