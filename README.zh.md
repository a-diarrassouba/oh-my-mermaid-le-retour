[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

> 本文档翻译自英文 README，部分表述可能不够自然。

<h1 align="center">prisme</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  棱镜将白光分解为清晰的色彩。<br/>
  <strong>prisme 将复杂的项目分解为任何人都能理解的部分——从初学者到资深开发者。</strong>
</p>

---

## 快速开始

prisme 尚未发布到 npm。请从源码安装，然后将技能注册到你的 AI 编程工具中：

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git prisme
cd prisme && npm install && npm link
prisme setup
```

之后，`prisme update` 会拉取并重新构建这个克隆。

在你想要理解的项目中，选择文档的语言（可选，默认为英文）：

```bash
prisme config language fr
```

然后在该项目中打开你的 AI 编程工具，运行 `/prisme-scan` 技能：

```
/prisme-scan
```

查看结果，并跟随查看器推荐的欢迎导览：

```bash
prisme view
```

## 工作原理

AI 阅读代码库并编写**视角**——从不同角度看待项目：它做什么、为谁服务，如何构建，数据如何流动，如何保护，如何运行、测试和发布，以及当前状态。每个视角都包含 Mermaid 图表和文档字段，使用你选择的语言。

每个元素都会被**递归分析**。复杂的元素成为拥有自己图表的嵌套元素，简单的保留为叶节点。文件系统反映了这个树结构：

```
.prisme/
├── functional-overview/            ← 视角
├── overall-architecture/
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
├── operations/
├── project-status/
└── .guides/                        ← 导览（逐步引导）
```

查看器自动从文件系统检测嵌套 — 有子元素的元素渲染为可展开的组，其他渲染为节点。

每个元素最多包含 7 个字段：`description`、`diagram`、`context`、`constraint`、`concern`、`todo`、`note`，以及一个显示标题。

### 导览

**导览**是逐步浏览图表的引导：查看器会打开每个元素，淡化其余部分，并高亮正在跟随的连线。在 AI 工具中使用 `/prisme-guide` 请求一个（例如 `/prisme-guide 用户注册时会发生什么？`）。`/prisme-scan` 还会编写欢迎导览 `start-here`，分为三部分（项目做什么、如何构建、如何运行、测试和发布），查看器会在首次访问时推荐它。导览保存在 `.prisme/.guides/` 中，当新的扫描破坏了某个导览时，`prisme validate` 会提示你。

### 提问

在查看器的提问栏中输入任何问题（例如"运行 `prisme write` 时会发生什么？"或"会话在哪里检查？"）。Claude Code 会在图表上作答：沿箭头描出路径、高亮需要查看的模块，或在相应行打开文件，每一步都附有解释。与此同时，与问题字词匹配的元素会高亮显示。回答保存在左侧面板的"我的问题"中。

这需要在运行 `prisme view` 的机器上安装并登录 Claude Code（运行 `claude`，然后 `/login`）；只打开查看器的人无需任何东西。Claude 只读取项目（从不读取 `.env` 文件或密钥），从不修改。`prisme view --no-ai` 可关闭提问功能。

安全评分来自一次审计：在 Claude Code 中运行 `/prisme-security`（或在终端运行 `claude "/prisme:prisme-security"`）。Claude 只阅读本仓库的代码，确认真实漏洞，排除误报并说明理由，解释每个漏洞及修复方法，prisme 计算 A–E 评分。查看器的安全页面会展示全部内容，其中的“用 Claude 运行审计”按钮会在后台运行同样的审计（只读、不修改），你可以在屏幕上跟进每一步。

## CLI

```bash
prisme setup                       # 将技能注册到 AI 工具
prisme view                        # 打开查看器：先选择水平，再进入三个空间（地图在 /map）
prisme view --no-ai                # 不向 Claude Code 提问 (API: docs/api.md)
prisme config language fr          # 设置文档和界面的语言
prisme guide list                  # 列出导览
prisme changes                     # 自上次扫描以来的变更
prisme security                    # 自动安全线索（评分由 /prisme-security 审计给出）
prisme security threats show       # /prisme-security 写下的威胁模型（按元素的 STRIDE）与设计问题
prisme evolve show                 # /prisme-evolve 写下的项目改进想法
prisme update                      # 更新到最新版本
```

运行 `prisme help` 查看完整命令列表。

## 技能

技能是在 **AI 编程工具内部**（而非终端）运行的命令，以 `/` 开头。

| 技能 | 功能 |
| --- | --- |
| `/prisme-scan` | 分析代码库 → 编写文档和欢迎导览 |
| `/prisme-guide` | 编写回答问题的逐步导览 → 在查看器中播放 |
| `/prisme-security` | 仓库安全审计：Claude 阅读代码，只保留真实漏洞并解释，给出 A–E 评分，写出威胁模型（按元素的 STRIDE）和设计问题，再修复你同意的问题 |
| `/prisme-evolve` | 简化、加速、扩展代码的想法，以及 3 到 5 个同类产品的功能与设计对比 |
| `/prisme-view` | 打开查看器 |

## 支持的 AI 工具

| 平台 | 设置 |
| --- | --- |
| Claude Code | `prisme setup claude` |
| Codex | `prisme setup codex` |
| Cursor | `prisme setup cursor` |
| OpenClaw | `prisme setup openclaw` |
| Antigravity | `prisme setup antigravity` |

运行 `prisme setup` 自动检测并配置所有已安装的工具。

## 开发与贡献

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git
cd oh-my-mermaid-le-retour
npm install && npm run build
npm test
```

欢迎提交 Issue 和 PR。请使用 [Conventional Commits](https://www.conventionalcommits.org/)。

## 致谢

prisme 最初是 [oh-my-mermaid](https://github.com/oh-my-mermaid/oh-my-mermaid) 的一个分支，该项目由其作者以 MIT 许可证发布。

## 许可证

[MIT](./LICENSE)
