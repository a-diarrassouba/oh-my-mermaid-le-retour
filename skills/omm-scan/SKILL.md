---
name: omm-scan
description: Scan codebase architecture and generate/update .omm/ documentation. Use when the user says "omm scan", "scan architecture", "update architecture", "refresh diagrams".
---

# omm-scan — Perspective-Based Architecture Scanner

## Purpose

Analyze the codebase and generate `.omm/` architecture documentation using **perspective-driven recursive analysis**.

- A **perspective** is a top-level element — a distinct way to look at the architecture.
- Each element in a diagram gets analyzed recursively. If it has internal structure, it becomes a **child element** (subdirectory with its own diagram). If not, it stays a leaf.
- The filesystem determines nesting. Element IDs in diagrams match child directory names. The viewer resolves groups from the filesystem.

## Prerequisites

```bash
command -v omm || npm install -g oh-my-mermaid
```

If the install fails, tell the user: "Please run `npm install -g oh-my-mermaid` in your terminal, then try again."

---

## Step 0: Check Language

```bash
omm config language
```

It prints a language code: `en` (the default), `fr`, `ko`, `ja`, `zh`, ... Everything a reader sees is written in that language:

- field content (description, context, constraint, concern, todo, note);
- element titles (`omm write <path> title`, see 3b and 3c);
- diagram labels: the first line of each node label and every edge label (see [Diagram Rules](#diagram-rules)).

Only identifiers stay in English kebab-case: element IDs, directory names, diagram node IDs, `classDef` names. File paths stay as they are in the code.

Example with `fr`: `data-store["Stockage des données\nsrc/main/store.ts"]`, title `Stockage des données`.

## Step 1: Explore the Codebase

Use Glob and Read to understand the project:

- Read `package.json`, `pyproject.toml`, or equivalent manifests
- List top-level directories to identify module boundaries
- Read key entry points (main, index, app files)
- Look for route definitions, service layers, database connections, external integrations
- Read what a newcomer needs beyond the code: `README`, `CONTRIBUTING`, `docs/`, `CHANGELOG`, roadmap files; the scripts (`package.json` scripts, `Makefile`); `.env.example` and config files; `Dockerfile` and compose files; CI workflows (`.github/workflows/`, `.gitlab-ci.yml`, ...); deployment configs (`vercel.json`, `fly.toml`, Kubernetes manifests, ...); test folders and test config; logging and monitoring libraries in the dependencies; `TODO` / `FIXME` comments

## Step 2: Select Perspectives

From the catalog below, choose which perspectives are meaningful for this codebase.

### Perspective Catalog

| Perspective | When to create | What it answers |
| --- | --- | --- |
| `functional-overview` | **Always** | What the application does, for whom, and its business rules |
| `operations` | **Always** | How to install, run, test, deploy and monitor it |
| `security` | Sign-in, user data, secrets or a public API | How access is controlled and what must stay protected |
| `project-status` | **Always** | What is done, in progress, fragile, planned, and what to ask the team |
| `overall-architecture` | **Always** | What exists and how pieces relate |
| `request-lifecycle` | Any server/API | How a request enters and gets handled end-to-end |
| `data-flow` | Any data processing, DB usage | Where data comes from, transforms, and lands |
| `dependency-map` | Complex module graph | What depends on what, what's shared |
| `external-integrations` | External APIs/services | What the system connects to and why |
| `state-transitions` | Stateful features (frontend or backend) | How state changes and what triggers it |
| `route-page-map` | Frontend with routing | Page structure and navigation flow |
| `command-surface` | CLI tools | Command hierarchy and dispatch |
| `extension-points` | Plugin/extension systems | Extension architecture and registry |
| `pipeline` | ML/data pipelines | Stage topology and data flow |
| `orchestration` | Event-driven/queue systems | Publisher, subscriber, broker topology |
| `storage` | 2+ storage systems | Storage topology (DB, cache, queue, object store) |

Don't force perspectives that don't exist in the code.

The first four rows are **onboarding perspectives**: they answer what a newcomer needs beyond the code. Write them after the architecture perspectives, since they reuse what the scan learned, and follow [Onboarding Perspectives](#onboarding-perspectives).

## Step 3: Generate Perspectives with Recursive Drill-Down

For each selected perspective, follow this recursive process:

### 3a. Write the perspective diagram

Element IDs match child directory names. The viewer resolves nesting from the filesystem.

```bash
omm write <perspective> diagram - <<'MERMAID'
graph LR
    renderer["Renderer\nsrc/renderer/"]
    renderer -->|"IPC invoke/on"| main-process["Main Process\nsrc/main/"]
    main-process -->|"spawn PTY"| engine-system["Engine System\nsrc/main/engine/"]
    main-process -->|"read/write JSON"| data-store["Data Store\nsrc/main/store.ts"]
    main-process -->|"xterm.js"| terminal-dock["Terminal Dock\nsrc/renderer/src/panel/"]
    main-process -->|"sign in"| github-oauth["GitHub OAuth\ngithub.com"]

    classDef entry fill:#89b4fa,stroke:#89b4fa,color:#1e1e2e
    classDef store fill:#a6e3a1,stroke:#a6e3a1,color:#1e1e2e
    classDef external fill:#585b70,stroke:#585b70,color:#cdd6f4
    class renderer entry
    class data-store store
    class github-oauth external
MERMAID
```

Every diagram follows the [Diagram Rules](#diagram-rules), including the mandatory roles.

### 3b. Write the title and the other fields

The diagram from 3a created the perspective's folder, so it can now get a title in the configured language. Then write its fields, each as a separate `omm write` command: `description` always; `context`, `constraint`, `concern`, `todo`, `note` only when there is something real to say (an empty or generic field is worse than none).

```bash
omm write <perspective> title "Overall architecture"
```

The viewer shows the title instead of the ID. Keep it short (a few words, at most 80 characters, one line).

### 3c. Recursive drill-down: analyze every element

**For every element in the diagram**, in this order (a perspective starts with its diagram in 3a only because it has no parent diagram):

1. **Analyze** the code it represents (Glob + Read the relevant files/directories)

2. **Write description for every node — no exceptions.** This creates the element directory. Optionally write other fields (context, constraint, concern, todo, note) if relevant — Write in the configured language.

   ```bash
   omm write <perspective>/<element-name> description - <<'EOF'
   (one plain sentence: what it is for)

   (then the technical part: what it does, which files/dirs it covers)
   EOF
   ```

   See [Writing for Everyone](#writing-for-everyone) for the first sentence.

3. **Write its title**, the same name as the first line of its label in the parent diagram. Always after the description: `title` refuses an element whose folder does not exist yet.

   ```bash
   omm write <perspective>/<element-name> title "Data store"
   ```

4. **Decide leaf or group:**
   - **Distinct internal components found** → write a diagram and recurse deeper (it becomes a group)
   - **No meaningful sub-components** (single file, trivial wrapper, external system) → it stays a leaf: stop here, after writing the other fields that have something real to say

5. **If group** — write diagram and recurse:

   ```bash
   omm write <perspective>/<element-name> diagram - <<'MERMAID'
   graph LR
       (internal elements)
   MERMAID
   ```

   Then repeat step 3c for each element in this diagram.

### Example recursion

```text
overall-architecture (perspective)
  elements: renderer, main-process, engine-system, data-store, terminal-dock

  → analyze renderer (src/renderer/)
    → finds: App.tsx, components/, hooks/, stores/, world/
    → group → write diagram with: components, stores, world
      → analyze components → 15 .tsx files, no sub-structure → leaf
      → analyze stores → 4 zustand stores → leaf
      → analyze world → OfficeCanvas + PixiJS logic → leaf

  → analyze main-process (src/main/)
    → finds: ipc.ts, auth/, engine/, terminal-session-service.ts, store.ts
    → group → write diagram with: auth, engine, terminal-session
      → analyze auth → auth-service.ts, callback-server.ts → leaf
      → analyze engine → claude-code.ts, codex.ts → leaf

  → analyze data-store (src/main/store.ts)
    → single file → leaf

  → analyze terminal-dock (src/renderer/src/panel/)
    → TerminalDock.tsx, DockManager → leaf
```

## Step 4: Summarize

Report what was created/updated and suggest `omm view` to view.

## Onboarding Perspectives

These perspectives follow the same rules as any element (plain first sentence, title, roles, real paths, fields), with these shapes.

### `functional-overview` — what the application does and why

- Diagram: who uses it and what they get. Users and outside actors (`external`), the features they use (every feature an actor reaches directly is `entry`), and what the features produce or change. Edges read as actions: `customer -->|"places an order"| checkout`.
- One element per main feature (a group if the feature has distinct sub-steps). Its description says what a user can do, in business words; the technical part names the code that implements it, which is the path in its label.
- Business rules a newcomer must not break go in `constraint` ("an order cannot be paid twice"). Say in `context` which features are critical and why.
- Sources: README, docs, pages and routes, CLI help, test names (they often describe behaviors).

### `operations` — how to run, test, ship and watch it

- Diagram, in order, as far as the project goes: `local-setup` → `tests` → `ci` → `environments` → `deployment` → `monitoring`. Leave out a stage the repository shows nothing for, and say so in the perspective's `note` ("No deployment configuration found"). Outside systems the stages rely on (package registry, hosting, error tracker) may appear as `external`.
- `local-setup`: prerequisites (runtime versions), install command, environment variables (names and purpose, never values), start command, and how to check it works (URL, health route, first command). Path: the file holding the commands (`package.json`, `Makefile`, `docker-compose.yml`).
- `tests`: kinds of tests, the command to run them, what they cover and what they do not, scenarios to check by hand.
- `ci`, `environments`, `deployment`: what triggers them, which environments exist, how secrets and variables are provided, database migrations, how to roll back.
- `monitoring`: where logs go, error reporting, metrics, alerts, how to diagnose a failure; known limits go in `concern`.
- Write exact commands in code spans, so they can be copied.

### `security` — when the project has sign-in, user data, secrets or a public API

- Diagram: how a user or a request gets access: entry points, authentication, sessions or tokens, authorization (roles, permissions), the protected resources (`store`), and where secrets come from.
- What must never be done goes in `constraint` ("never log tokens"); weak spots and missing protections in `concern`.

### `project-status` — where the project stands

- Diagram with up to five leaves and **no edges** (they are not steps of a flow, and the 5-to-15 rule does not apply): `done` (what works and is shipped), `in-progress` (half-done work), `fragile` (fragile code, known bugs, technical debt; give it the `concern` role), `planned` (roadmap, ideas), `open-questions`. Leave out an element with nothing to say, and say so in the perspective's `note`.
- Each element lists concrete items in its description, with the file where each was found (`TODO` comments, `CHANGELOG`, roadmap files, skipped tests). The path in its label is the main source, or the two main ones.
- `open-questions` lists what a newcomer needs but the repository cannot tell: who owns what, who has production access, recurring incidents, priorities, what a first task could be. Phrase each as a question to ask the team. Its label's second line is `?`.
- Write only what the sources show: a guess about the project's state is worse than a question in `open-questions`.

An element that appears in several perspectives (a login, a config file) is described there from that perspective's angle: what it means for the product, for operations, for security. Do not copy the same text.

**Never copy a secret value** (password, token, key), even from a sample file: name the variable and say what it is for.

## Writing for Everyone

The readers include people who do not code (product, newcomers). Every `description` starts with **one plain sentence** that says what the element is for, in everyday words: no jargon, no file names, no acronyms without explanation. The technical details come after, in a new paragraph.

- Good: "Keeps every user's documents so they are still there after a restart." Then: "SQLite database accessed through `src/db/`, ..."
- Not good: "Repository layer wrapping the ORM."

The other fields can stay technical.

## Diagram Rules

- **Element IDs must match the child directory name.** Use kebab-case: `main-process`, `data-store`, `terminal-dock`.
- **Element labels use two-line format**: name + file path, separated by `\n`. The name is written in the configured language; the path is not translated. For an element made of several files, give their common folder; for an external system (service, API, AI tool), give its name or URL. External systems are leaves, with a description like any element:

  ```text
  main-process["Main Process\nsrc/main/"]
  auth-service["Auth Service\nsrc/auth/service.ts"]
  ```

- **Every label has a real path.** The second line is a file or folder that exists in the repository, written from the repository root (folders end with `/`). Check it with Glob before writing; never guess a path. When an element spans two places and their common folder says nothing (like `src/`), list both: `src/commands/push.ts, src/lib/cloud.ts`. Exceptions, where the second line says where the thing lives instead:
  - an external system: its name, domain or command (`ohmymermaid.com`, `Claude Code`, `git`), not translated;
  - a person or group using the system: how they reach it (`browser`, `terminal`, `mobile app`, `API`);
  - a storage outside the repository: its location (`~/.omm/credentials.json`, `localStorage`, `PostgreSQL`);
  - `project-status/open-questions`, which holds what the repository does not tell: `?`.
- **A diagram shows only its own elements.** A child diagram lists the parts of that element; how it connects to its siblings is already in the parent diagram, so do not repeat outside elements there (each node would become a duplicate child).
- The same element may appear in several perspectives with the same ID (each perspective has its own folder for it).
- Every edge must have a meaningful label, in the configured language: `A -->|"why this connection exists"| B`
- Aim for 5 to 15 elements per diagram. More than that means some of them belong together: group them into a child element and recurse deeper.
- Use `graph LR` for most diagrams, `graph TD` for hierarchies.
- **Mark the role of elements with `classDef` — this is mandatory, not decoration.** The viewer and the questions asked in it rely on these roles to find "where data is stored", "where it starts" or "what is outside". In every diagram:

  | Style | Color | Required on |
  | --- | --- | --- |
  | `entry` | `#89b4fa` | **Every** entry point: where a user, a request, a command or an event comes in (HTTP handler, CLI, page, queue consumer, cron job) |
  | `store` | `#a6e3a1` | **Every** persistent storage: database, cache, files on disk, object storage, browser storage |
  | `external` | `#585b70` | **Every** system outside this codebase: third-party API, cloud service, another team's service, AI tool |
  | `concern` | `#f38ba8` | Optional: a known risk or bottleneck (explain it in the element's `concern` field) |

  What counts, within the diagram you are drawing:
  - `entry` is the first element that receives something from **outside the system**: a person, the network, a scheduler, an event such as a push that starts a CI workflow, another program. Code reached only through another element of this project is not an entry, even if it handles a command or a route. A group whose main job is to receive outside input (a web server) is an entry too.
  - `store` is where data stays after the program stops. Code that reads or writes the data is not a store; the database or the folder is.
  - `external` is anything this repository does not contain, including local tools (`git`) and AI assistants.

  Declare only the styles the diagram uses, with exactly these colors, then apply them with `class` lines listing node IDs. Use `class a,b store`, not `a:::store`: the viewer ignores the `:::` form. An element has at most one role; when none applies (plain internal code), leave it unstyled. `entry`, `store` and `external` win over `concern`: a risky store stays `store`, and its risk goes in its `concern` field.

  ```text
  classDef external fill:#585b70,stroke:#585b70,color:#cdd6f4
  classDef concern fill:#f38ba8,stroke:#f38ba8,color:#1e1e2e
  classDef entry fill:#89b4fa,stroke:#89b4fa,color:#1e1e2e
  classDef store fill:#a6e3a1,stroke:#a6e3a1,color:#1e1e2e
  ```

## What Each Field Holds

Each field has one job. Put a fact in the field that matches it, so readers (and the questions asked in the viewer) find it in the same place in every project.

| Field | Holds | Typical sources |
| --- | --- | --- |
| `description` | **Required.** What the element is for (one plain sentence), then what it does and which files it covers | Code, README |
| `context` | Why it is built this way: decisions, history, trade-offs | Comments, commit messages, docs, ADRs |
| `constraint` | Rules that must stay true when changing it: invariants, limits, formats, conventions to respect | Validation code, tests, comments like "must" / "never" |
| `concern` | What can go wrong: fragile parts, known bugs, security or performance risks, technical debt | `FIXME`, `HACK`, missing tests, error-prone code |
| `todo` | Work not finished or planned | `TODO` comments, stubs, disabled code, roadmap files |
| `note` | Anything useful that fits none of the above (how to run or debug it, a gotcha) | Scripts, config, docs |

For a perspective as a whole, write `context` (why this view matters for this project) and `concern` (risks that cross several elements) when there are any; element-level details belong to the elements.

Write only what the code or the docs show. A conclusion drawn from an absence is written as one ("No database found", not "There is no database"); a conclusion drawn from how a library or a platform behaves names that library or platform. When something important cannot be found (who owns it, how it is deployed), say so in `note` instead of guessing.

## General Rules

- **Write each field as a separate `omm write` command.** Each `omm write` must be its own Bash tool call.
- **Run `omm write` commands one at a time, never in parallel.** Each write also updates the parent's `meta.yaml`; two writes at once can lose a child.
- If `omm write <path> title ...` answers `invalid field 'title'`, the CLI is too old: tell the user to run `omm update`, and keep scanning without titles.
- Do not rewrite elements that haven't changed. Fixing something you wrote earlier in the same scan is fine.
- Do not create circular references. A child element must never reference its parent.
