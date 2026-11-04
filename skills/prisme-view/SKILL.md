---
name: prisme-view
description: Start the prisme web viewer to explore architecture diagrams in the browser. Use when the user says "prisme view", "open viewer", "show diagrams", "view architecture", or "open architecture".
argument-hint: "[--port <port>]"
---

# prisme-view — Architecture Viewer

## Purpose

Launch the interactive web viewer so the user can explore `.prisme/` architecture diagrams in their browser.

## Prerequisites

Ensure the `prisme` CLI is available:

```bash
command -v prisme || npm install -g github:a-diarrassouba/oh-my-mermaid-le-retour
```

If the install command fails (permission denied), tell the user:
"Please run `npm install -g github:a-diarrassouba/oh-my-mermaid-le-retour` in your terminal, then try again."

## Steps

### Step 1: Verify .prisme/ exists

```bash
prisme list
```

If no classes found, tell the user:
"No architecture docs found. Run `/prisme-scan` first to generate them."
Then stop.

### Step 2: Start the viewer

```bash
prisme view
```

If the user specified a port:

```bash
prisme view --port <port>
```

### Step 3: Report

Tell the user the viewer is running and provide the URL (default: `http://localhost:3000`).

The viewer auto-refreshes when `.prisme/` files change.

## Rules

- Always check for existing classes before starting the viewer
- If no classes exist, suggest `/prisme-scan` instead of starting an empty viewer
- The viewer is read-only — it does not modify `.prisme/` files
