[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

<h1 align="center">prisme</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  A prism splits white light into clear colors.<br/>
  <strong>prisme splits a complex project into parts anyone can understand — from a beginner to a senior developer.</strong>
</p>

---

## Quick Start

prisme is not on npm yet. Install it from its source, then register its skills with your AI coding tools:

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git prisme
cd prisme && npm install && npm link
prisme setup
```

Later, `prisme update` pulls and rebuilds this clone.

In the project you want to understand, choose the language of the docs (optional, English by default):

```bash
prisme config language fr
```

Then open your AI coding tool in that project and run the `/prisme-scan` skill:

```
/prisme-scan
```

View the result, and follow the welcome guide the viewer offers:

```bash
prisme view
```

## How It Works

Your AI reads the codebase and writes **perspectives** — different lenses on the project: what it does and for whom, how it is built, how data flows, how it is secured, how to run, test and ship it, and where it stands. Each perspective holds a Mermaid diagram and documentation fields, in the language you chose.

Every element gets **recursively analyzed**. Complex ones become nested elements with their own diagrams; simple ones stay as leaves. The filesystem reflects the tree:

```
.prisme/
├── functional-overview/            ← perspective
├── overall-architecture/
│   ├── description.md
│   ├── diagram.mmd
│   ├── context.md
│   ├── main-process/               ← nested element
│   │   ├── description.md
│   │   ├── diagram.mmd
│   │   └── auth-service/           ← deeper nesting
│   │       └── ...
│   └── renderer/
│       └── ...
├── data-flow/
├── operations/
├── project-status/
└── .guides/                        ← guides (step-by-step walks)
```

The viewer auto-detects nesting from the filesystem — elements with children render as expandable groups, others as nodes.

Each element carries up to 7 fields: `description`, `diagram`, `context`, `constraint`, `concern`, `todo`, `note`, and a display title.

### Guides

A **guide** is a step-by-step walk through the diagrams: the viewer opens each element, fades the rest and lights the edge being followed. Ask your AI tool for one with `/prisme-guide` (for example `/prisme-guide what happens when a user signs up?`). `/prisme-scan` also writes a welcome guide, `start-here`, in three parts (what the project does, how it is built, how to run, test and ship it), and the viewer offers it on the first visit. Guides live in `.prisme/.guides/`, and `prisme validate` tells you when a new scan breaks one.

### Questions

Type any question in the viewer's question bar (for example "what happens when I run `prisme write`?" or "where is the session checked?"). Claude Code answers on the map: it traces the path along the arrows, lights the blocks to look at, or opens the file at the right lines, each step with its explanation. Meanwhile the elements that match your words light up. Answers are kept under "Your questions" in the left panel.

This needs Claude Code installed and logged in (`claude`, then `/login`) on the machine that runs `prisme view`; people who only open the viewer need nothing. Claude may only read the project (never `.env` files or keys), never change it. `prisme view --no-ai` turns questions off.

The security score comes from an audit: run `/prisme-security` in Claude Code (or `claude "/prisme:prisme-security"` in a terminal). Claude reads the code of the repository, and only that one, confirms the real flaws, dismisses the false ones with the reason, explains each flaw and the fix, and prisme computes the grade from A to E. The Security page of the viewer shows it all.

## CLI

```bash
prisme setup                       # Register skills with your AI tools
prisme view                        # Open the viewer: choose your level, then the three spaces (map at /map)
prisme view --no-ai                # Same, without the questions to Claude Code (API: docs/api.md)
prisme config language fr          # Set the language of the docs and the interface
prisme guide list                  # List guides (step-by-step walks)
prisme changes                     # What changed since the last scan
prisme security                    # Automatic security leads, used by the audit (/prisme-security gives the grade)
prisme security threats show       # Threat model (STRIDE per element) and design questions, written by /prisme-security
prisme evolve show                 # Ideas to make the project evolve, written by /prisme-evolve
prisme update                      # Update to the latest version
```

Run `prisme help` for the full command list.

## Skills

Skills are commands you run **inside your AI coding tool** (not the terminal). They start with `/`.

| Skill | What it does |
| --- | --- |
| `/prisme-scan` | Analyze the codebase → write the docs and the welcome guide |
| `/prisme-guide` | Write a step-by-step guide that answers a question, played in the viewer |
| `/prisme-security` | Security audit of the repository: Claude reads the code, keeps the real flaws, explains them, gives the grade A–E, writes the threat model (STRIDE per element) and design questions, then fixes what you agree to |
| `/prisme-evolve` | Ideas to simplify, speed up and go further in the code, and what 3 to 5 similar products do (features, design) |
| `/prisme-view` | Open the viewer |

## Supported AI Tools

| Platform | Setup |
| --- | --- |
| Claude Code | `prisme setup claude` |
| Codex | `prisme setup codex` |
| Cursor | `prisme setup cursor` |
| OpenClaw | `prisme setup openclaw` |
| Antigravity | `prisme setup antigravity` |

Run `prisme setup` to auto-detect and configure all installed tools.

## Development & Contributing

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git
cd oh-my-mermaid-le-retour
npm install && npm run build
npm test
```

Issues and PRs welcome. Use [Conventional Commits](https://www.conventionalcommits.org/).

## Credits

prisme started as a fork of [oh-my-mermaid](https://github.com/oh-my-mermaid/oh-my-mermaid), by its authors, under the MIT license.

## License

[MIT](./LICENSE)
