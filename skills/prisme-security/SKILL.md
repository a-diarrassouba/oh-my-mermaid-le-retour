---
name: prisme-security
description: Audit the security of the repository it is run in, by reading its code — confirm the real flaws, dismiss the false ones with the reason, explain each flaw in plain words, give a grade from A to E, and write a threat model of the map (STRIDE per element) with secure-by-design questions. Use when the user says "prisme security", "security audit", "security score", "is my code secure?", "threat model", "STRIDE", "secure by design", "check for secrets", "vulnerabilities", or asks what the security grade means.
argument-hint: "[--audit-only | --threats-only]"
---

# prisme-security — Security Audit

## Purpose

A security audit of **the repository this skill is run in, and only that one**, done by reading its code. At the end:

- a **grade from A to E**, computed by prisme from the flaws you confirm, always with the same rubric;
- each **confirmed flaw**, explained so a beginner understands it: what is wrong, what an attacker could do in this project, the proof in the code, how to fix it;
- the **dismissed leads**, each with the reason (false alarm, not reachable, development only…), so nobody wastes time on them again;
- the **areas checked**, so the reader knows what was and was not looked at;
- a **threat model** of the map and **secure-by-design questions**.

The viewer shows all of it on its Security page (`prisme view`, "Security score").

**The flaws are found by reading the code**, by two auditors working in parallel, then challenged by a verifier who tries to prove them wrong; you judge and write the audit (see [How the Audit Is Run](#how-the-audit-is-run-two-auditors-a-verifier-a-judge)). Automatic checks only give leads: never put a lead in the audit without confirming it in the code.

With `--audit-only`, do Steps 0 to 6 and 10; with `--threats-only`, Steps 7 to 10. Without arguments, do everything.

## Rules

- **Scope: this repository only.** Its root is `git rev-parse --show-toplevel` (or the current folder outside git). The files to audit are the ones `git ls-files` lists there. Never read, cite or count anything in `.claude/` (Claude Code worktrees are copies of the project), `node_modules/`, `vendor/`, build output (`dist/`, `build/`, `.next/`…), other repositories or folders above the root.
- **Read-only until the user agrees.** The audit changes no code. Fixes come at the end, one by one, with the user's agreement (Step 10).
- **Never print a secret.** Quote a secret by its first 4 characters and `…` at most.
- **Confirm before you report.** A flaw is confirmed only when you have read the code path and can say how it would be exploited here. When in doubt, read more; if still in doubt, it is not a finding — mention it in the summary as a point to check.
- **Severity follows the [rubric](#severity-rubric)**, not the label of a tool or an advisory.
- Write everything the reader sees in the project's language (`prisme config language`).
- **One shell command at a time**: no `&&`, `;`, `|` or redirections. Combined commands may be refused (they always are when the audit runs from the viewer). Read files with the Read, Grep and Glob tools rather than the shell.
- **A refused command never stops the audit**: get the information another way (read the files, the map) and go on; say in the summary what could not be checked.

## Step 0: Prerequisites and Scope

Run each command on its own:

```bash
prisme config language
```

```bash
prisme security scope
```

The second prints the root, the number of files git tracks there (without `.claude/`, dependencies and builds) and the main folders. Note them. If `prisme security audit show` answers `invalid field` (or `champ invalide`), the CLI is too old: tell the user to run `prisme update`, then stop.

On a large repository (more than ~2,000 files), tell the user the audit focuses on what runs in production and handles outside input first; areas only skimmed get the status `partial`. Tell the user too that the audit uses three agents (two auditors, a verifier) and takes a while.

## Step 1: Understand the Project

Read the map first when it exists (`.prisme/`), it is cheaper than the code:

```bash
prisme tree
prisme read overall-architecture description
prisme read security description
prisme read operations description
```

(Skip what does not exist; without a map, read the README, the package manifests and the folder layout.) Write down, for yourself:

- what the project does and for whom; what is deployed (web app, API, CLI, mobile, library);
- **entry points**: HTTP routes and handlers, webhooks, CLI commands, queues and jobs, file uploads, anything that receives input from outside;
- **data**: databases, files, caches; what is personal or sensitive;
- **auth**: how users sign in, how sessions or tokens work, roles;
- **outside services**: third-party APIs, cloud, email, payments;
- **how it runs in production**: Dockerfiles, CI/CD workflows, infrastructure files, environment variables (`.env.example`).

## Step 2: Gather Leads

Leads point at places to read; they are not findings. You give them to the auditors (Step 3).

```bash
prisme security --json --no-tools
```

It lists patterns (secrets, risky calls, CI and Docker practices). Many are false alarms: example files, tests, safe APIs that look unsafe. Note them: the auditors check each one (Step 3).

Dependencies with known flaws (production dependencies only):

```bash
npm audit --omit=dev --json
```

(Use the project's package manager when it is not npm: `pnpm audit --prod --json`, `yarn npm audit --environment production --json`; for Python, Go, Rust… read the lockfile and only report what you can check. Install nothing.)

## How the Audit Is Run: Two Auditors, a Verifier, a Judge

Like a trial: two **auditors** look for flaws in parallel, each on half of the areas, so a large repository is read in depth; then a **verifier** who did not take part tries to prove them wrong, in both directions (a flaw that is not real, a lead wrongly dismissed, an area marked "ok" too fast); finally **you are the judge**: you settle each disagreement by reading the code, and you write the audit.

Use the **Agent** tool (general-purpose agents). Agents start with an empty context: everything they need goes in their prompt. If the Agent tool is not available, do Steps 3 to 5 yourself, one after the other, and write `process: { auditors: 1, verified: false, refuted: 0, added: 0 }`.

### The areas

| Area (`area`) | What to look for |
| --- | --- |
| `secrets` | Real keys, tokens, passwords in tracked files; `.env` committed. Example files and local test values are not secrets. |
| `auth` | Sign-in, password storage (hash algorithm), sessions and tokens (signature checked, expiry, storage), password reset, MFA, brute force protection, service-to-service secrets and what they allow. |
| `access-control` | Every route that reads or changes data: is the user checked, and is the object theirs (IDOR)? Admin routes, roles, multi-tenant isolation. |
| `injection` | SQL (raw queries built from input; ORMs' safe forms are fine), shell commands, templates, NoSQL, LDAP, eval. |
| `xss` | HTML built from user content, `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, markdown rendering without cleaning, unsafe CSP. |
| `files` | Paths from input (traversal), uploads (type, size, where stored, served back how), archive extraction, file permissions. |
| `ssrf` | Server-side requests to URLs from input, webhooks, image fetchers, redirects (open redirect). |
| `crypto` | Weak or homemade crypto, random values for secrets, TLS checks turned off, keys in code. |
| `dependencies` | Known flaws in **production** dependencies that the code actually uses in a reachable way; abandoned or suspicious packages. |
| `config` | CORS, cookies (Secure, HttpOnly, SameSite), security headers, debug modes, error messages that leak details, default credentials, Docker running as root. |
| `ci-cd` | Workflow rights, secrets in CI, untrusted input in scripts, unpinned third-party actions, deploy keys, `pull_request_target`. |
| `data-exposure` | Personal or sensitive data in logs, API responses returning more than needed, backups, analytics. |
| `dos` | Missing limits that matter here: request size, rate limiting on sign-in and costly endpoints, unbounded loops on input, background workers. |

### Severity rubric

The context of **this** project decides, not the label of a tool or an advisory:

- **critical**: exploitable now, from the outside, without special access, with a severe impact: a live production secret in the repository, unauthenticated remote code execution, SQL injection on a public route, authentication bypass.
- **high**: exploitable with little effort or a common condition, significant impact: a signed-in user can read or change other users' data (IDOR), stored XSS, a secret for a non-production service with real access, a reachable vulnerable dependency with a known exploit.
- **medium**: a real weakness with limited impact or hard to exploit: no rate limit on sign-in, missing security headers that matter here, a vulnerable dependency reachable only under a specific configuration, verbose errors exposing internals.
- **low**: hardening and good practice: no `SECURITY.md`, unpinned CI actions, container running as root, no dependency update bot.

prisme turns the severities into the grade: 100 minus 30 per critical, 15 per high, 6 per medium (30 at most) and 2 per low (10 at most); A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, else E; any critical caps the grade at D, any high at C.

## Step 3: Two Auditors, in Parallel

Write a **brief** of the project from Step 1 (what it does, entry points, data, auth, outside services, how it is deployed, with file paths) and split the leads of Step 2 by area. Then launch **both auditors in the same message** (two Agent calls), so they run in parallel:

- **Auditor 1**: `secrets`, `auth`, `access-control`, `injection`, `xss`, `files`, `ssrf`.
- **Auditor 2**: `crypto`, `dependencies`, `config`, `ci-cd`, `data-exposure`, `dos`.

Each auditor's prompt contains, in this order:

1. Its role: "You audit the security of the repository at `<root>`, read-only, for the areas below. Read the code with Read, Grep and Glob; never change a file."
2. The scope rules of this skill (only files `git ls-files` lists at the root; never `.claude/`, dependencies, build output; never print a secret).
3. The project brief.
4. Its areas, with their rows of the areas table.
5. The leads of its areas (file, line, what the automatic check saw).
6. The method: for each area, search and **read** the code, starting from the entry points and following the data; for every candidate, trace it (source → checks in between → sink), check it runs in production (not tests, one-off scripts, dev tools, examples), then decide: confirmed or dismissed. Group the same flaw in one finding with the other files in `also`; one finding per dependency to update.
7. The severity rubric.
8. The answer it must give, and nothing else:

```yaml
findings:
  - title: "…"
    severity: high
    area: access-control
    owasp: A01
    file: path/as/git/lists/it
    lines: "40-58"
    what: "…"
    impact: "…"
    evidence: "the path from input to the risky code, with files and lines"
    fix: "…"
    effort: small
    also: [other/file.ts]
dismissed:
  - title: "…"
    file: "…"
    reason: "…"
checked:
  - area: access-control
    status: issues    # ok | issues | partial | not-applicable
    note: "what was read, what was found"
```

## Step 4: Contradictory Verification

When both auditors have answered, launch **one verifier** (one Agent call). It must not see the auditors' reasoning: give it only their **conclusions**.

Its prompt contains:

1. Its role: "You are a contradictory verifier. Two auditors reviewed the repository at `<root>`. Your job is to prove them wrong where they are wrong, by reading the code. Read-only; never change a file."
2. The scope rules, the project brief, the areas table and the severity rubric.
3. **The findings, without their `evidence`**: for each one, its number, title, severity, file, lines, `what` and `impact`. For each: try to refute it: is the input really controlled by an attacker, is there a check the auditor missed (middleware, framework protection, validation elsewhere), does this code run in production, is the severity right for this project?
4. **The dismissed leads, with their reasons.** For each: is the reason true in the code? If not, it is a real flaw.
5. **The areas marked `ok` or `partial`, with their notes.** Pick in each the riskiest places the note does not mention and read them: did the auditors miss something?
6. The answer it must give, and nothing else:

```yaml
findings:
  - number: 1
    verdict: confirmed    # confirmed | refuted | uncertain
    severity: high        # the severity it would give
    proof: "what in the code supports the verdict, with files and lines"
dismissed:
  - title: "…"
    verdict: agree        # agree | reopen
    proof: "…"
missed:                   # flaws nobody reported
  - (same fields as an auditor's finding, evidence included)
```

## Step 5: Judge

You decide, flaw by flaw, with these rules:

- **confirmed** by the verifier: keep it, `verification: confirmed`. If the verifier gives another severity, read the code and pick the one the rubric supports.
- **refuted** with a proof in the code: read the code it cites. If the proof holds, move the flaw to `dismissed` with the verifier's reason. If it does not hold, keep the flaw, `verification: contested`, and say in `verificationNote` why the refutation fails.
- **uncertain**: read the code yourself and decide; a flaw you cannot confirm is not kept (mention it in the summary as a point to check).
- A dismissed lead the verifier wants to **reopen**, and every **missed** flaw: read the code; if it is real, add it with `verification: added` and say in `verificationNote` what the verifier found; otherwise leave it dismissed.
- Rate every flaw you keep with the rubric; merge duplicates between the two auditors.

Count for `process`: `auditors: 2`, `verified: true`, `refuted` (flaws moved to dismissed after verification), `added` (flaws kept with `verification: added`).

## Step 6: Write the Audit

One YAML document, in the project's language; texts in double quotes or `|` blocks; file paths relative to the root, exactly as `git ls-files` prints them. `checked` covers every area, merged from both auditors and corrected by your decisions.

Write it with the Write tool to **`.prisme/.drafts/audit.yaml`** (the drafts folder; it works the same in Claude Code and from the viewer's button, where it is the only place you may write), then have prisme check it and compute the grade:

```bash
prisme security audit write .prisme/.drafts/audit.yaml
```

The draft (here with an example finding):

```yaml
summary: |
  (4 to 6 sentences, plain words: what the project exposes, the overall state, the two or three things to fix first, what the verification changed, and what was not checked deeply)
process: { auditors: 2, verified: true, refuted: 1, added: 1 }
findings:
  - title: "Any signed-in user can read other users' tickets"
    severity: high
    area: access-control
    owasp: A01
    file: apps/api/src/routes/tickets.ts
    lines: "40-58"
    what: "The route GET /tickets/:id loads the ticket by its id without checking that it belongs to the user."
    impact: "A user who changes the number in the address sees the tickets of other companies, with their contents."
    evidence: "tickets.ts:44 calls prisma.ticket.findUnique({ where: { id } }) with req.params.id; the auth middleware only checks that a user is signed in (auth.ts:12); no ownerId filter."
    fix: "Add ownerId: req.user.id to the where clause (or check ticket.ownerId after loading) and return 404 otherwise; same for PATCH and DELETE."
    effort: small
    also: [apps/api/src/routes/comments.ts]
    verification: confirmed
dismissed:
  - title: "Database password in .env.example"
    file: apps/api/.env.example
    reason: "Example file with placeholder values, not a real secret."
checked:
  - area: secrets
    status: ok
    note: "No real secret in tracked files; .env is ignored."
  # … one entry for every area: ok, issues, partial (looked at quickly) or not-applicable (with why)
```

It is refused, with the reasons, when a file is not in this repository, lines do not exist, an area is missing from `checked` or marked `ok` while it has a finding, a `contested` or `added` flaw has no `verificationNote`, or a required text is missing. Fix the draft and run the command again; once accepted, the draft is removed and the previous audit is replaced.

## Step 7: Threat Model (STRIDE per Element)

Skip it if there is no `.prisme/` map (suggest `/prisme-scan` first).

Use the map and what you learned in Steps 1 to 4:

1. **Assets**: what must be protected (accounts, personal data, API keys, the ability to deploy…). 3 to 10.
2. **Trust boundaries**: the arrows where data crosses from something you do not control to something you do (browser, webhook, third-party API, CI runner, uploaded file). `entry` and `external` roles in the diagrams point at them.
3. **Threats**: for each element on a boundary or holding an asset, keep the **realistic** threats by STRIDE — **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege — with likelihood, impact, and `status`: `mitigated` (say what protects, with the file), `open` (say what to do; it should match a finding when it is a flaw), `accepted` (say why). 5 to 25 threats.

## Step 8: Secure-by-Design Questions

10 to 30 questions the team should be able to answer about the design, grouped by `theme` (Authentication, Data, Secrets, Exchanges, Errors and logs, Dependencies, Deployment…), aimed at this project's elements ("The ticket API receives ids from the browser: does every route check ownership?", not "Is input validated?"). Answer from the code when you can (`status: answered`, with the file); otherwise `status: open`, a question for the team.

## Step 9: Write the Threat Model

Write it to **`.prisme/.drafts/threats.yaml`** with the Write tool, then:

```bash
prisme security threats write .prisme/.drafts/threats.yaml
```

The draft:

```yaml
summary: |
  (3 to 5 sentences)
assets: ["…"]
boundaries:
  - from: overall-architecture/browser
    to: overall-architecture/api
    why: "…"
threats:
  - element: overall-architecture/api
    stride: [E, I]
    title: "…"
    scenario: "…"
    likelihood: medium
    impact: high
    status: open
    control: "…"
    files: [apps/api/src/routes/tickets.ts]
questions:
  - theme: "…"
    question: "…"
    status: answered
    answer: "…"
    elements: [overall-architecture/api]
```

Element paths are copied from `prisme tree`; it is refused with the reasons otherwise.

## Step 10: Report and Offer Fixes

Tell the user, in the project's language and at their level (ask once if you do not know it):

1. **The grade** and what it means in one or two sentences.
2. **What to fix first**: the confirmed flaws, most severe first, each in plain words (what could happen, where, the fix and its effort).
3. **What was dismissed** and why, in a few lines, so they trust the result.
4. **What was not checked deeply** (areas marked `partial`).

Then offer the fixes as a numbered list and **change code only for the ones the user approves**. A real secret: first revoke it at the service that issued it and create a new one; removing it from the code is not enough (it stays in git history). After fixes, run Steps 3 to 6 again on the changed areas and write the audit again so the grade reflects them.

Suggest `prisme view`: the Security page shows the grade, the flaws, the dismissed leads, the areas checked and the threat model; "See … on the map" opens the element that holds a file.
