---
name: omm-guide
description: Create a guide (a step-by-step walk) through the .omm/ architecture docs, played in the omm viewer. Use when the user says "omm guide", "make a guide", "make a tour", "onboarding guide", "walk me through X", "explain how X works step by step", or asks "what happens when ...?" about the system.
---

# omm-guide — Guides

## Purpose

A **guide** ("parcours" in the French interface) is an ordered walk through elements that already exist in `.omm/`. The viewer plays it step by step: it opens each element, fades the rest of the diagram and animates the edge of the step.

A guide holds the order, the edge or nodes to look at, and for each step a short headline (`say`) and an explanation (`details`). The element's own fields (description, constraints, ...) stay in the element. Two kinds:

| Kind | Use it for | Each step |
| --- | --- | --- |
| `trace` | "What happens when …?" (a request, a command, an event) | follows a real edge of the diagram, from an element already visited |
| `path` | A learning goal: "understand the storage", onboarding | opens an element; steps don't need to be linked |

## Prerequisites

```bash
omm guide list
```

If it prints an error, the CLI is too old (it reads `guide` as an element and answers `error: invalid field 'list'`): tell the user to run `omm update` (or `npm install -g oh-my-mermaid`), then try again. Never write `.omm/.guides/` by hand instead.

The list also shows which guide ids are already taken.

If there is no `.omm/` directory, run `/omm-scan` first: a guide can only point at elements that exist.

## Step 0: Check Language

```bash
omm config language
```

It prints a language code (`en` by default, `fr`, ...). Write `title`, every `say`, every `details` and every `part` in that language. Guide ids, element paths and node ids are always English kebab-case, as in `.omm/`.

## Step 1: Read the map

```bash
omm list
omm tree <perspective>
omm read <perspective> diagram
```

If `omm list` shows a `glossary` perspective, also run `omm tree glossary`: it lists the terms your steps can point to.

Find the perspective that answers the question (`request-lifecycle`, `data-flow`, `command-surface`, `overall-architecture`, ...). The edges of a step `perspective/x` come from the diagram of its **parent**, `perspective`: read that one (for a step `perspective/group/y`, read `omm read perspective/group diagram`). Note the node ids, the edges and the roles: `class ... entry` marks where things come in (a trace usually starts there), `class ... store` where data is kept, `class ... external` what is outside the project.

## Step 2: Choose the kind and the steps

**Trace** (as many steps as the behavior really has, usually 3 to 8), all under the same parent diagram:
1. Start at the element where the behavior begins, usually an `entry` node. Never start a trace at a perspective: a perspective is not a node of any diagram, so no edge can leave it.
2. For each next step, pick an element linked by an **edge of the same parent diagram** to an element already visited. Branches are fine; jumps are not.
3. Write the edge exactly as in the diagram, in its direction: `from --> to` (labels optional: `from -->|label| to`).
4. If the behavior crosses a link that the diagram does not have, stop the trace there and tell the user. Never invent an edge: suggest running `/omm-scan` to complete the diagram.

**Path**: go from general to specific. Start with a perspective, then its key groups (entry points, core storage), then one or two leaves that matter. Its length follows the goal: a small topic needs few steps, a broad one more.

**Parts** (optional): when a guide covers several themes, give every step a `part` (a short name, e.g. "Functional", "Technical"). The viewer shows "Part 2/3 — Technical". Either every step has a part or none does, and the steps of one part follow each other.

**Audience:**
- `developer` (default): technical words, file names welcome.
- `newcomer`: onboarding, no prior knowledge assumed.
- `product`: managers, product owners, clients. Business words only, and stay on perspectives and top-level groups.

## Step 3: Write each step

While a guide runs, the viewer's panel shows **only the step**, not the element's sheet. So each step must explain itself, for someone who sees the project for the first time:

- **`say`**: the headline. What to notice here, in one or two sentences (under 280 characters).
- **`details`**: the explanation, in Markdown, a few short paragraphs or bullets. Aim for 300 to 800 characters; 1500 is a ceiling, and the CLI warns above it.
  1. **What happens here**, concretely, at this step of the walk.
  2. **Why it is built this way**, when the reason is not obvious.
  3. **Words to know**, only when the step introduces a new term (not one an earlier step already defined): define it in plain words. Point to a glossary entry only if `omm tree glossary` lists it; never cite one that does not exist.
  4. **What to remember**, in one sentence.

Write for the guide's audience: `newcomer` defines every term; `developer` may name files and functions; `product` uses business words only and says what the step changes for users. Do not copy the element's description: explain the step, in the order of the walk. Never state something the `.omm/` docs or the code do not show.

## Step 4: Write the guide

Pick a guide id that `omm guide list` does not show: writing an existing id replaces that guide. To update an existing guide on purpose, read it first with `omm guide show <guide-id>` and keep its id. Never write `start-here` from this skill: `/omm-scan` owns it.

Put `title`, every `say` and every `part` in double quotes: translated text often contains `: ` (French) or `#`, which break plain YAML. Write `details` as a `|` block, indented under the step, so Markdown and colons need no quoting.

The CLI checks the guide against `.omm/` and **refuses to write it if it is invalid**. Read the errors, fix the YAML and run it again.

```bash
omm guide write <guide-id> - <<'YAML'
title: "What happens when a user saves a document?"
kind: trace
audience: developer
duration: 5m
steps:
  - element: request-lifecycle/api-router
    say: "Every save enters through the router, which checks the session first."
    details: |
      The browser sends the document to `POST /documents/:id`. Before anything else, the router checks the **session**: a signed cookie that proves who is logged in. Without a valid session the request stops here with a 401.

      **Words to know**: a *router* maps each URL to the code that handles it.

      To remember: no save reaches the business logic without a known user.
  - element: request-lifecycle/document-service
    edge: api-router --> document-service
    say: "The service validates the document and decides whether it is a new version."
  - element: request-lifecycle/postgres
    edge: document-service --> postgres
    focus: [audit-log]
    say: "Versions are stored in one transaction with the audit log entry."
YAML
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | The question or goal, in the configured language |
| `kind` | yes | `trace` or `path` |
| `audience` | no | `developer` (default), `newcomer`, `product` |
| `duration` | no | Rough reading time, e.g. `5m` |
| `after` | no | Ids of guides to follow first, e.g. `[start-here]` |
| `start` | no | `true` only for the project's single onboarding guide (`start-here`) |
| `steps[].element` | yes | Element path: `perspective/group/leaf` |
| `steps[].edge` | trace: yes after step 1 | Edge of the parent diagram: `from --> to` |
| `steps[].focus` | no | Other node ids of the parent diagram to keep lit |
| `steps[].part` | no | Chapter name; all steps or none, steps of one part together |
| `steps[].say` | yes | What to notice, 1–2 sentences: the step's headline |
| `steps[].details` | no, but expected | The explanation, Markdown, a few short paragraphs (use a `\|` block) |

## Step 5: Report

Tell the user the guide id and how to play it:

```bash
omm view
```

Then open `http://localhost:3000/#guide=<guide-id>&step=1`, or pick the guide in the **Guides** section of the viewer ("Parcours" in French).

## Rules

- One guide per question or goal. Guide ids are English kebab-case: `save-a-document`, `understand-storage`.
- Always write guides with `omm guide write`, never by editing `.omm/.guides/` by hand: the command is what keeps broken guides out.
- Never set `start: true`, and never write `start-here`: the onboarding guide belongs to `/omm-scan`.
- Never delete a guide you did not create in this conversation without asking the user.
- After a scan renames or removes elements, run `omm validate`: it lists guides that no longer match, so they can be fixed or deleted with `omm guide delete <guide-id>`.
