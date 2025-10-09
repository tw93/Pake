# GitHub Actions 使用指南

<h4 align="right"><strong><a href="github-actions-usage.md">English</a></strong> | 简体中文</h4>

无需本地安装开发工具，在线构建 Pake 应用。

## 快速步骤

### 1. Fork 仓库

[Fork 此项目](https://github.com/tw93/Pake/fork)

### 2. 运行工作流

1. 前往你 Fork 的仓库的 Actions 页面
2. 选择 `Build App With Pake CLI`
3. 填写表单（参数与 [CLI 选项](cli-usage_CN.md) 相同）
4. 点击 `Run Workflow`

   ![Actions 界面](https://raw.githubusercontent.com/tw93/static/main/pake/action.png)

### 3. 下载应用

- 绿色勾号 = 构建成功
- 点击工作流名称查看详情
- 在 `Artifacts` 部分下载应用

  ![构建成功](https://raw.githubusercontent.com/tw93/static/main/pake/action2.png)

### 4. 构建时间

- **首次运行**：约 10-15 分钟（建立缓存）
- **后续运行**：约 5 分钟（使用缓存）
- 缓存大小：完成时为 400-600MB

## 提示

- 首次运行需要耐心等待，让缓存完全建立
- 建议网络连接稳定
- 如果构建失败，删除缓存后重试

## 链接

- [CLI 文档](cli-usage_CN.md)
- [高级用法](advanced-usage_CN.md)
