[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

> 本文档翻译自英文 README。部分表述可能不够自然。

<p align="center">
  <img src="./docs/logo.jpg" alt="omm logo" width="80"/>
</p>

<h1 align="center">Oh-my-mermaid</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-my-mermaid"><img src="https://img.shields.io/npm/v/oh-my-mermaid" alt="npm version"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  AI 几秒钟就能写出代码。人类理解它需要几个小时。<br/>
  跳过理解，代码库就变成了黑盒 — 即使对你自己而言。<br/><br/>
  <strong>omm 弥合了这个差距 — 由 AI 生成的、为人类准备的架构文档。</strong>
</p>

---

## 快速开始

在终端中粘贴：

```bash
npm install -g oh-my-mermaid && omm setup
```

打开你的 AI 编码工具，使用 `/omm-scan` 技能：

```
/omm-scan
```

就这样。查看结果：

```bash
omm view
```

## 示例

> omm 扫描了自己。这是它发现的结果。

<table><tr>
<td width="50%"><img src="./docs/screenshot.png" alt="omm viewer"/></td>
<td width="50%"><img src="./docs/demo.gif" alt="omm scan demo"/></td>
</tr></table>

## 工作原理

AI 分析代码库并生成 **视角（perspective）** — 观察架构的不同镜头（结构、数据流、外部集成等）。每个视角包含 Mermaid 图表和文档字段。

每个节点都会被**递归分析**。复杂的节点会成为具有自己图表的嵌套子元素。简单的节点保持为叶子节点。文件系统直接反映树结构：

```
.omm/
├── overall-architecture/           ← 视角
│   ├── description.md
│   ├── diagram.mmd
│   ├── context.md
│   ├── main-process/               ← 嵌套元素
│   │   ├── description.md
│   │   ├── diagram.mmd
│   │   └── auth-service/           ← 更深层嵌套
│   │       └── ...
│   └── renderer/
│       └── ...
├── data-flow/
├── external-integrations/
└── .guides/                        ← 导览（逐步引导）
```

查看器自动从文件系统检测嵌套 — 有子元素的元素渲染为可展开的组，其他渲染为节点。

每个元素最多包含 7 个字段：`description`、`diagram`、`context`、`constraint`、`concern`、`todo`、`note`。

### 导览

**导览**是逐步浏览图表的引导：查看器会打开每个元素，淡化其余部分，并高亮正在跟随的连线。在 AI 工具中使用 `/omm-guide` 请求一个（例如 `/omm-guide 用户注册时会发生什么？`）。`/omm-scan` 还会编写欢迎导览 `start-here`，分为三部分（项目做什么、如何构建、如何运行、测试和发布），查看器会在首次访问时推荐它。导览保存在 `.omm/.guides/` 中，当新的扫描破坏了某个导览时，`omm validate` 会提示你。

## CLI

```bash
omm setup                          # 向 AI 工具注册技能
omm view                           # 打开交互式查看器
omm config language zh             # 设置内容语言
omm guide list                     # 列出导览
omm update                         # 更新到最新版本
```

完整命令列表请运行 `omm help`。

## 技能

技能是在 **AI 编码工具内部**运行的命令（不是终端）。以 `/` 开头。

| 技能 | 功能 |
| --- | --- |
| `/omm-scan` | 分析代码库 → 生成架构文档 |
| `/omm-guide` | 编写回答问题的逐步导览 → 在查看器中播放 |
| `/omm-push` | 一步完成登录 + 链接 + 推送到云端 |

## 云端

通过 [ohmymermaid.com](https://ohmymermaid.com) 将架构存储在云端。

```bash
omm login && omm link && omm push
```

默认为私有。可以与团队共享，或像[这个示例](https://ohmymermaid.com/share/c47e20a7063c231760361ed9cb9ec4b6)一样公开。

## 支持的 AI 工具

| 平台 | 设置 |
| --- | --- |
| Claude Code | `omm setup claude` |
| Codex | `omm setup codex` |
| Cursor | `omm setup cursor` |
| OpenClaw | `omm setup openclaw` |
| Antigravity | `omm setup antigravity` |

运行 `omm setup` 自动检测并配置所有已安装的工具。

## 路线图

请参阅 [docs/ROADMAP.md](./docs/ROADMAP.md)。

## 开发 & 贡献

```bash
git clone https://github.com/oh-my-mermaid/oh-my-mermaid.git
cd oh-my-mermaid
npm install && npm run build
npm test
```

欢迎提交 Issue 和 PR。请使用 [Conventional Commits](https://www.conventionalcommits.org/)。

## 许可证

[MIT](./LICENSE)
