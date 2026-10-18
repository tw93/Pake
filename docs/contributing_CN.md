# 参与贡献

<div align="center">

[English](contributing.md) · **中文**

</div>

欢迎提交修复、文档、示例和建议的 PR。新功能先开一个 [issue](https://github.com/tw93/Pake/issues) 聊聊有没有必要做，错别字或者把一句话写得更清楚，直接提 PR 就行。

## 改代码

所有开发都在 `main` 上进行，PR 也提到 `main`。环境准备、项目结构和常用命令都在[开发工作流](advanced-usage_CN.md#开发工作流)里，最常用的是这两条：

```bash
# 同时跑 CLI 和应用，改 CLI 时最快的调试方式
pnpm run cli:dev -- https://web.telegram.org/k/

# 构建 CLI，跑测试，再跑真实构建的冒烟测试
pnpm test
```

## 推荐网站进精选

Mac 和 Windows 版 Pake 里有一个精选，放的是适合做成桌面应用的网站。每个网站对应 [`gallery/apps`](https://github.com/tw93/Pake/tree/main/gallery/apps) 里一份很小的配方，谁都可以推荐：

1. 先用 Pake CLI 把网站打包出来用几天，登录一下，点开几个链接，下载一个文件，重启后看看是否还保持登录。
2. 新增 `gallery/apps/<id>.json`，窗口参数只在确实解决了问题时才加，注入的 CSS 或 JavaScript 也只做最小的改动。
3. 运行 `npx vitest run tests/unit/gallery.test.ts`。
4. 提一个 PR，写清楚测了什么、在哪个平台上测的。

描述就用大白话写网站是做什么的，不写评分和口号。需要付费账号的网站可以收，主要靠广告的网站、要你填别家服务账号密码的网站不收。每个字段的说明见[精选配方说明](../gallery/README.md)。

## 名字和图标

开源协议管的是代码，不管品牌。发布 Pake 的分支或基于它做的产品时，请用自己的名字和图标，也不要暗示它得到了 Pake 的认可，完整内容见[商标政策](../TRADEMARK.md)。
