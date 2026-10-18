# 脚本与 AI 智能体

<div align="center">

[English](ai-agents.md) · **中文**

</div>

Pake 有一套机器可读的模式，脚本或 AI 智能体可以直接打包应用、读取结果，不用去解析构建日志。

## 用到的三样东西

- [`--json`](cli-usage_CN.md#json)：stdout 只输出一个 JSON 结果，日志全部走 stderr，交互式提问也会关掉，退出码和错误码在同一节里。
- [`--config app.json`](cli-usage_CN.md#config)：把应用写进一个文件，不用拼一长串参数。字段是驼峰写法的参数名加上 `url`，按[公开的 schema](../schema/pake.schema.json) 校验，命令行上显式给的参数优先于文件里的值。
- `pake ./dist --name MyTool`：直接打包本地构建产物，目录根部要有 `index.html`。

```bash
pake --config app.json --json
```

## 智能体约定

[llms.txt](../llms.txt) 用一页讲清智能体需要知道的内容，包括 JSON 结构、退出码、配置规则和各平台的注意事项。随最新版本发布的那一份在 `https://unpkg.com/pake-cli@latest/llms.txt`。

## 安装 skill

官方的 Pake skill 会教 Claude Code 和 Codex 按上面的方式来做。

```text
# Claude Code
/plugin marketplace add tw93/Pake
/plugin install pake@pake

# Codex
codex plugin marketplace add tw93/Pake
codex plugin add pake@pake
```

## 拿来就用的提示词

没装 skill 的话，把下面这段发给你的智能体，填好最后一句就行：

```text
用 Pake（npm i -g pake-cli）把网页打包成桌面应用。先阅读 https://unpkg.com/pake-cli@latest/llms.txt，运行 pake 时始终加 --json 并把 stdout 解析为单个 JSON 对象。把 <url-or-local-dist> 打包成名为 <AppName> 的应用。
```
