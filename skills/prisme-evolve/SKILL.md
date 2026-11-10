---
name: prisme-evolve
description: Suggest how to make the project evolve, at two levels — the code itself (simplify, speed up, go further) and similar products found on the web (features, design and UX) — and save the ideas for the prisme viewer. Use when the user says "prisme evolve", "how can I improve my project", "what should I build next", "what do competitors do", "ideas for my app", or asks to compare the project with similar products.
argument-hint: "[--code | --market]"
---

# prisme-evolve — Make the Project Evolve

## Purpose

Give the user concrete, sourced ideas to move the project forward, at two levels:

1. **In the code** (`code`): what to **simplify** (duplicated or tangled code, dead code, dependencies that do little), what to **speed up** (slow paths, repeated work, heavy loads), and how to **go further** (the natural next features the code is close to supporting).
2. **Around you** (`market`): **3 to 5 similar products** you find on the web, and the **features** and **design/UX** ideas they suggest for this project.

The ideas are written with `prisme evolve write`, which checks them and saves `.prisme/.reports/evolve.json`. The viewer shows them on its "Make it evolve" page (home screen).

With `--code`, do level 1 only; with `--market`, level 2 only. Without arguments, do both.

## Prerequisites

```bash
prisme config language
```

```bash
prisme tree
```

- If `prisme` is missing, tell the user to install it (see the README).
- `prisme config language` prints the language to write in (`en`, `fr`, ...): `summary`, every `title`, `why`, `how`, `what` and `similar` go in that language.
- `prisme tree` lists the elements. If there is no `.prisme/` yet, run `/prisme-scan` first: the ideas point at elements of the map.
- If `prisme evolve write` later answers `invalid field` (or `champ invalide`), the CLI is too old: tell the user to run `prisme update`.

## Step 1: Understand the Project

Read the map before the code, it is cheaper:

```bash
prisme read functional-overview description
prisme read overall-architecture description
prisme read overall-architecture diagram
prisme read project-status description
```

(Skip the perspectives that do not exist.) Note in one sentence what the project does, for whom, and its main parts. Read `todo` and `concern` fields of the main elements (`prisme read <path> todo`): they often say what the team already wants to change.

## Step 2: Level 1 — In the Code

Open the files of the main elements (their paths are in the labels of the diagrams) and look for, with evidence from the code:

- **simplify**: the same logic in several places, a module that does too much, abstractions used once, unused code or dependencies, configuration spread out.
- **speed**: work done again and again (reading the same files, recomputing), requests in a loop, heavy imports at startup, large payloads, missing cache or index. Only claim a speed gain you can explain from the code.
- **further**: features the code is close to supporting (a format, an option, an integration), gaps the `todo` and `concern` fields name, tests or tooling that would let the team move faster.

Keep the 3 to 8 ideas with the best impact for their effort. Each idea:

- `title`: what to do, in a few words.
- `why`: what it brings, in plain words a non-developer understands (time saved, fewer bugs, a new use).
- `how`: Markdown, concrete steps with the files and functions involved, small enough to start tomorrow.
- `effort`: `small` (hours), `medium` (days), `large` (weeks). `impact`: `low`, `medium`, `high`.
- `elements`: the element paths it touches (copied from `prisme tree`), so the viewer can show them. `files`: the main files.

## Step 3: Level 2 — Around You

Find **3 to 5 products similar to this one** with a web search: same job for the same kind of user (open source projects and commercial products both count). Prefer well-known, active products. For each, read its site or docs (features page, docs, screenshots, changelog), not just the search snippet. Never invent a product, a feature or a URL: if you cannot open a page, leave that product out. If you find fewer than 3 real ones, say so and keep those.

Then list the ideas they give for this project:

- **feature**: something users of those products can do and users of this one cannot, that fits this project's purpose.
- **design**: how they present things (onboarding, empty states, navigation, wording, accessibility, mobile) that would make this project easier to use.

Each idea has `title`, `why`, `how`, `effort`, `impact` like level 1, `seenIn` (product names, exactly as in `products`), and `elements` when it touches parts of the map. 3 to 10 ideas, the most useful first. Do not copy a product's look or brand: describe the idea, adapted to this project.

## Step 4: Write the Ideas

Put the whole report in one YAML document; each text in double quotes, `how` as a `|` block. Write it with the Write tool to **`.prisme/.drafts/evolve.yaml`**, then have prisme check and save it:

```bash
prisme evolve write .prisme/.drafts/evolve.yaml
```

The draft:

```yaml
summary: |
  (3 to 5 sentences: where the project stands, the two or three ideas to do first and why)
code:
  - kind: simplify            # simplify | speed | further
    title: "Merge the two config readers"
    why: "One place to change settings, fewer surprises."
    how: |
      1. Move `readConfig` from `src/a.ts` into `src/lib/config.ts`.
      2. ...
    effort: small             # small | medium | large
    impact: medium            # low | medium | high
    elements: [overall-architecture/config]
    files: [src/a.ts, src/lib/config.ts]
market:
  products:
    - name: "Product name"
      url: "https://..."
      what: "What it is, in one sentence."
      similar: "Why it compares with this project."
  ideas:
    - kind: feature           # feature | design
      title: "..."
      why: "..."
      how: |
        ...
      effort: medium
      impact: high
      seenIn: ["Product name"]
```

It is refused, with the reasons, when a key is unknown, a value is missing or too long, an element does not exist, a URL is not http(s), or `seenIn` names a product not in `products`. Fix the draft and run the command again; once accepted, the draft is removed. With `--code`, leave `market` out; with `--market`, leave `code` out (the previous report is replaced, so keep the other level from `prisme evolve show` if the user wants both).

## Step 5: Summarize

Tell the user, in the configured language: the two or three ideas to do first, the products you compared with (with their links), and anything you could not check. Suggest `prisme view`, then "Make it evolve" on the home screen. Offer to start on one idea; change code only when the user asks.
