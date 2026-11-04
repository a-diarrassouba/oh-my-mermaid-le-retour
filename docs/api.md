# prisme viewer API — v1

`prisme view` serves the viewer and a JSON API at `http://localhost:<port>/api/v1/`. The API is the contract between the docs in `.prisme/` and any front (the viewer, a script, the next viewer): new fields may appear in v1, existing ones keep their name and meaning.

## Security

- The server listens on `127.0.0.1` only, and answers only to `Host: localhost:<port>` or `127.0.0.1:<port>` (no DNS rebinding). Any other host gets `403`.
- No `Access-Control-Allow-Origin` header: another site cannot read the API from a browser.
- `X-Frame-Options: DENY`: no site can show the viewer in a frame.
- Questions to Claude (`/api/v1/ask/ai…`) also need the `X-Prisme-Token` header, a secret drawn when the viewer starts and handed only to the page (`window.__prismeAI.token`), and an `Origin` that is the viewer itself. `prisme view --no-ai` turns them off.

Every route below is `GET` unless noted. Errors are `{ "error": "<reason>" }` with a 4xx/5xx status.

## `GET /api/v1/project`

```json
{
  "api": 1,
  "name": "my-project",
  "language": "fr",
  "version": "0.3.0",
  "lastScan": { "commit": "2457871…", "date": "2026-11-04T10:00:00.000Z" },
  "counts": { "perspectives": 8, "elements": 78, "guides": 2 },
  "categories": {
    "understand": { "available": true },
    "security": { "available": true, "grade": "B", "score": 82, "date": "…", "counts": { "critical": 0, "high": 1, "medium": 0, "low": 1 } },
    "evolve": { "available": true, "date": "…", "code": 5, "products": 4, "ideas": 6 }
  },
  "ai": { "available": true }
}
```

- `language`: the language of the docs (`prisme config language`).
- `version`: the prisme version serving the API.
- `lastScan`: the commit the last scan described, `null` before `prisme changes --mark`.
- `categories.*.available`: whether there is something to show — elements for `understand`, `.prisme/.reports/security.json` (`prisme security`) for `security`, `.prisme/.reports/evolve.json` (`/prisme-evolve`) for `evolve`. `security` also gives the grade, score, date and counts by severity.
- `ai`: whether the viewer can send questions to Claude Code on this machine; when not, `reason` says why (Claude Code not installed, Windows, `--no-ai`).

## `GET /api/v1/elements`

Every element, perspectives first, depth first:

```json
[
  {
    "path": "overall-architecture/store",
    "parent": "overall-architecture",
    "id": "store",
    "title": "Stockage",
    "kind": "leaf",
    "role": "store",
    "icon": "database",
    "files": ["src/lib/store.ts"],
    "depth": 1,
    "children": [],
    "fields": { "description": "…", "concern": "…" },
    "explain": { "novice": "Comme un grand classeur…", "deeper": "…", "junior": "…" },
    "updated": "2026-11-02T09:12:00.000Z"
  }
]
```

- `kind`: `perspective` (top level), `group` (has children) or `leaf`.
- `title`: the element's title, else the first line of its label in the parent diagram, else its id.
- `role`: `entry`, `store`, `external`, `concern` or `null`, from the parent diagram.
- `files`: the second line of its label: files, folders, or the name of an external system.
- `fields`: only the fields the element has, among `description`, `diagram`, `constraint`, `concern`, `context`, `todo`, `note` (Markdown, or Mermaid for `diagram`).
- `icon`: one word among `app`, `api`, `server`, `database`, `storage`, `file`, `folder`, `terminal`, `browser`, `screen`, `mobile`, `user`, `users`, `lock`, `key`, `shield`, `settings`, `plug`, `cloud`, `network`, `queue`, `message`, `mail`, `bell`, `clock`, `search`, `chart`, `book`, `test`, `build`, `package`, `git`, `bot`, `code`, `globe`, `link`, `layers`, `map`, `compass`, `flag`, `wrench`, `zap`, `eye`, `palette`, `calendar`, `cart`, `payment`, `puzzle`, `filter`, `refresh` (`ICONS` in `src/lib/explain.ts`); `null` when the scan gave none.
- `explain`: the element explained by reader level, from `explain.yaml`: `novice` (an everyday image, then the real words one at a time), `deeper` (the novice's "learn more"), `junior` (how it works, with files and patterns). The senior level is `fields.description`. `null` when the scan has not written it.

## `GET /api/v1/elements/<path>`

One element, same shape. `404` when it does not exist.

## `GET /api/v1/guides` and `GET /api/v1/guides/<id>`

Every guide in `.prisme/.guides/`, with its validation, so a front can show a guide a scan broke as "needs fixing":

```json
[{ "id": "start-here", "valid": true, "issues": [], "guide": { "id": "start-here", "title": "…", "kind": "path", "audience": "newcomer", "start": true, "steps": [{ "element": "…", "say": "…", "details": "…", "part": "…" }] } }]
```

## `GET /api/v1/security`

The last report of `prisme security`, `404` before the first one:

```json
{
  "version": 1, "date": "2026-11-04T10:00:00.000Z", "commit": "2457871…",
  "grade": "B", "score": 82,
  "counts": { "critical": 0, "high": 1, "medium": 0, "low": 1 },
  "files": 89,
  "findings": [{
    "rule": "tls-disabled", "severity": "high",
    "title": "Certificate checks are turned off", "why": "…", "fix": "…",
    "file": "src/http.ts", "line": 12, "match": "rejectUnauthorized: false", "source": "prisme",
    "elements": ["overall-architecture/http-client"]
  }],
  "ignored": [{ "rule": "html-injection", "file": "src/view.ts", "line": 40, "reason": "Escaped before.", "…": "…" }],
  "tools": [{ "name": "npm audit", "status": "ran", "findings": 0 }, { "name": "gitleaks", "status": "missing", "findings": 0 }]
}
```

- `grade`: `A` (≥ 90) to `E` (< 40), from a score that starts at 100 and loses 30 / 15 / 6 / 2 points per critical / high / medium / low finding, at most two findings per rule. Any critical finding caps the grade at `D`, any high one at `C`.
- `title`, `why`, `fix`: in the project's language when it is French, else English.
- `match`: what was found; secrets are masked (`AKIA…ZZ`).
- `elements`: up to three elements whose label cites the finding's file, deepest first, to show it on the map.
- `ignored`: findings left out by `.prisme/security.yaml` (`ignore: [{ rule, file?, line?, reason }]`, written by `/prisme-security` with the user's agreement), with the reason. They do not count in the grade.
- `source`: `prisme` (base checks), `npm-audit`, `gitleaks`, `osv-scanner` or `semgrep`. `tools` says which ran, which are not installed (`missing`), failed or were skipped (`--no-tools`).

## `GET /api/v1/evolve`

The ideas `/prisme-evolve` wrote (checked by `prisme evolve write`), `404` before the first ones:

```json
{
  "version": 1, "date": "…", "commit": "…",
  "summary": "Markdown: where the project stands and what to do first",
  "code": [{
    "kind": "speed", "title": "…", "why": "…", "how": "Markdown steps",
    "effort": "small", "impact": "high",
    "elements": ["overall-architecture/server"], "files": ["src/server/api.ts"]
  }],
  "market": {
    "products": [{ "name": "…", "url": "https://…", "what": "…", "similar": "…" }],
    "ideas": [{ "kind": "design", "title": "…", "why": "…", "how": "…", "effort": "small", "impact": "medium", "seenIn": ["…"] }]
  }
}
```

- `code`: level 1, the project itself. `kind` is `simplify`, `speed` or `further`.
- `market`: level 2, 3 to 5 similar products the AI found on the web and the ideas they suggest; `kind` is `feature` or `design`, `seenIn` names products of `products`. `null` when only level 1 was written.
- `effort`: `small`, `medium`, `large`; `impact`: `low`, `medium`, `high`; `elements`: existing element paths.

## `GET /api/v1/ask?q=<question>`

Search without AI over every element's fields. Up to 8 results, best first:

```json
{ "query": "where are files written", "results": [{ "cls": "overall-architecture/store", "title": "Stockage", "score": 7.5, "field": "description", "snippet": "…" }] }
```

## Questions to Claude

Claude Code (`claude`) must be installed and logged in on the machine running `prisme view`; the reader's browser needs nothing. Claude gets no tools: the server sends it the `.prisme/` map and the question, reads the guide it answers with, and writes it through the same checks as `prisme guide write`. One question at a time, 4 minutes at most.

### `POST /api/v1/ask/ai`

Body `{ "question": "How is a scan recorded?" }` (3 to 300 characters). Answers `202` with the job:

```json
{ "id": "9f2c4e1a7b3d5e60", "question": "How is a scan recorded?", "guideId": "ask-m3x9k2", "state": "running", "startedAt": 1793790000000 }
```

`409` with `{ "error", "job" }` when another question is being answered, `503` when Claude Code is not available.

### `GET /api/v1/ask/ai/<id>`

The job. `state` becomes `done` (the guide `guideId` is written, load it from `/api/v1/guides/<guideId>`) or `failed` (with `error`).

### `GET /api/v1/ask/ai/current`

The job being answered, or `null`, so a reloaded page can follow it again.

## Older routes

`/api/config`, `/api/guides`, `/api/ask`, `/api/classes`, `/api/class/…` serve the current viewer. They stay until the new viewer replaces it; new fronts should use `/api/v1/`.
