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

**You find the flaws by reading the code.** Automatic checks only give leads: never put a lead in the audit without confirming it in the code.

With `--audit-only`, do Steps 0 to 6 and 10; with `--threats-only`, Steps 7 to 10. Without arguments, do everything.

## Rules

- **Scope: this repository only.** Its root is `git rev-parse --show-toplevel` (or the current folder outside git). The files to audit are the ones `git ls-files` lists there. Never read, cite or count anything in `.claude/` (Claude Code worktrees are copies of the project), `node_modules/`, `vendor/`, build output (`dist/`, `build/`, `.next/`…), other repositories or folders above the root.
- **Read-only until the user agrees.** The audit changes no code. Fixes come at the end, one by one, with the user's agreement (Step 10).
- **Never print a secret.** Quote a secret by its first 4 characters and `…` at most.
- **Confirm before you report.** A flaw is confirmed only when you have read the code path and can say how it would be exploited here. When in doubt, read more; if still in doubt, it is not a finding — mention it in the summary as a point to check.
- **Severity follows the rubric of Step 5**, not the label of a tool or an advisory.
- Write everything the reader sees in the project's language (`prisme config language`).

## Step 0: Prerequisites and Scope

```bash
command -v prisme && prisme config language
git rev-parse --show-toplevel
git ls-files | wc -l
git ls-files | grep -v '^\.claude/' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40
```

Note the root, the number of files and the main folders. If `prisme security audit show` answers `invalid field` (or `champ invalide`), the CLI is too old: tell the user to run `prisme update`, then stop.

On a large repository (more than ~2,000 files), tell the user the audit focuses on what runs in production and handles outside input first; areas you only skim get the status `partial`.

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

Leads point at places to read; they are not findings.

```bash
prisme security --json --no-tools
```

It lists patterns (secrets, risky calls, CI and Docker practices). Many are false alarms: example files, tests, safe APIs that look unsafe. Note them, then check each in Step 4.

Dependencies with known flaws (production dependencies only):

```bash
npm audit --omit=dev --json 2>/dev/null | head -c 200000
```

(Use the project's package manager when it is not npm: `pnpm audit --prod --json`, `yarn npm audit --environment production --json`; for Python, Go, Rust… read the lockfile and only report what you can check. Install nothing.)

## Step 3: Review the Code, Area by Area

Go through **every area** below. For each, search the code (Grep, Glob), then **read** the relevant files. Start from the entry points of Step 1 and follow the data.

| Area (`area`) | What to look for |
| --- | --- |
| `secrets` | Real keys, tokens, passwords in tracked files or history-prone places; `.env` committed. Example files and local test values are not secrets. |
| `auth` | Sign-in, password storage (hash algorithm), sessions and tokens (signature checked, expiry, storage), password reset, MFA, brute force protection. |
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
| `dos` | Missing limits that matter here: request size, rate limiting on sign-in and costly endpoints, unbounded loops on input. |

## Step 4: Confirm or Dismiss Each Candidate

For every lead (Step 2) and every suspicion (Step 3):

1. **Trace it**: where does the input come from (source), where does it end up (sink), what happens in between (validation, escaping, auth checks, framework protection)?
2. **Is it reachable in production?** Development tools, tests, one-off scripts that are never deployed, example files and dead code are not.
3. **Decide**:
   - **confirmed**: you can describe the exploitation in this project → a finding (Step 5);
   - **dismissed**: write the short reason ("`.env.example`: placeholder values", "`$executeRaw` with a tagged template is parameterized by Prisma", "vitest is a dev dependency, never deployed", "CI database on localhost, only exists during tests").

Group the same flaw: one finding per problem, with the other files in `also` (one finding "Routes without ownership check" listing 6 routes, not 6 findings). For dependencies: **one finding per package to update**, only when it is a production dependency used in a reachable way; others are dismissed with the reason.

## Step 5: Rate Each Confirmed Flaw

Use this rubric — the context of **this** project, not the advisory's label:

- **critical**: exploitable now, from the outside, without special access, with a severe impact: a live production secret in the repository, unauthenticated remote code execution, SQL injection on a public route, authentication bypass.
- **high**: exploitable with little effort or a common condition, significant impact: a signed-in user can read or change other users' data (IDOR), stored XSS, a secret for a non-production service with real access, a reachable vulnerable dependency with a known exploit.
- **medium**: a real weakness with limited impact or hard to exploit: no rate limit on sign-in, missing security headers that matter here, a vulnerable dependency reachable only under a specific configuration, verbose errors exposing internals.
- **low**: hardening and good practice: no `SECURITY.md`, unpinned CI actions, container running as root, no dependency update bot.

Each finding also gets `effort` (small: an hour; medium: days; large: weeks) and, when it fits, an `owasp` code (A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable and Outdated Components, A07 Identification and Authentication Failures, A08 Software and Data Integrity Failures, A09 Security Logging and Monitoring Failures, A10 SSRF).

prisme turns the severities into the grade: 100 minus 30 per critical, 15 per high, 6 per medium (30 at most) and 2 per low (10 at most); A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, else E; any critical caps the grade at D, any high at C.

## Step 6: Write the Audit

One YAML document, in the project's language; texts in double quotes or `|` blocks; file paths relative to the root, exactly as `git ls-files` prints them.

```bash
prisme security audit write - <<'YAML'
summary: |
  (4 to 6 sentences, plain words: what the project exposes, the overall state, the two or three things to fix first, and what was not checked deeply)
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
dismissed:
  - title: "Database password in .env.example"
    file: apps/api/.env.example
    reason: "Example file with placeholder values, not a real secret."
checked:
  - area: secrets
    status: ok
    note: "No real secret in tracked files; .env is ignored."
  - area: access-control
    status: issues
    note: "Ticket and comment routes do not check ownership."
  # … one entry for every area of Step 3: ok, issues, partial (looked at quickly) or not-applicable (with why)
YAML
```

It is refused, with the reasons, when a file is not in this repository, lines do not exist, an area is missing from `checked` or marked `ok` while it has a finding, or a required text is missing. Fix and write again; the previous audit is replaced.

## Step 7: Threat Model (STRIDE per Element)

Skip it if there is no `.prisme/` map (suggest `/prisme-scan` first).

Use the map and what you learned in Steps 1 to 4:

1. **Assets**: what must be protected (accounts, personal data, API keys, the ability to deploy…). 3 to 10.
2. **Trust boundaries**: the arrows where data crosses from something you do not control to something you do (browser, webhook, third-party API, CI runner, uploaded file). `entry` and `external` roles in the diagrams point at them.
3. **Threats**: for each element on a boundary or holding an asset, keep the **realistic** threats by STRIDE — **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege — with likelihood, impact, and `status`: `mitigated` (say what protects, with the file), `open` (say what to do; it should match a finding when it is a flaw), `accepted` (say why). 5 to 25 threats.

## Step 8: Secure-by-Design Questions

10 to 30 questions the team should be able to answer about the design, grouped by `theme` (Authentication, Data, Secrets, Exchanges, Errors and logs, Dependencies, Deployment…), aimed at this project's elements ("The ticket API receives ids from the browser: does every route check ownership?", not "Is input validated?"). Answer from the code when you can (`status: answered`, with the file); otherwise `status: open`, a question for the team.

## Step 9: Write the Threat Model

```bash
prisme security threats write - <<'YAML'
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
YAML
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
