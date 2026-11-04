---
name: prisme-security
description: Check the security of the project and explain it in plain words, with a grade from A to E, then help fix what matters. Use when the user says "prisme security", "security score", "is my code secure?", "security audit", "check for secrets", "vulnerabilities", or asks what the security grade means.
argument-hint: "[--no-tools]"
---

# prisme-security — Security Score, Explained and Fixed

## Purpose

`prisme security` computes a grade from A to E with **automatic checks, no AI**, like a vehicle inspection: it reads the project's files (secrets, risky code, repository hygiene), runs `npm audit` on production dependencies, and adds the findings of gitleaks, osv-scanner and semgrep **when they are installed**. It writes `.prisme/.reports/security.json`, which the viewer shows on its Security page.

This skill adds what the command cannot do: check each finding in the code (real problem or false alarm), explain it at the reader's level, and fix what the user agrees to fix.

## Prerequisites

```bash
command -v prisme && prisme config language
```

If `prisme` is missing, tell the user to install it (see the README). `prisme config language` prints the language to talk and write in (`en`, `fr`, ...).

## Step 1: Run the Check

```bash
prisme security --json
```

Pass `--no-tools` only if the user asks for a quick check (no `npm audit`, no installed scanners). The command prints the report; it is also saved in `.prisme/.reports/security.json`.

If it answers `invalid field '--json'` (or `champ invalide`), the CLI is too old: tell the user to run `prisme update`, then stop.

Each finding has `rule`, `severity` (critical, high, medium, low), `title`, `why`, `fix`, its OWASP Top 10 category in `owasp` (name it when you explain, e.g. "A03 Injection"), often `file`, `line` and `match` (secrets are masked: never try to read or print the full value). `tools` says which tools ran, which are `missing`, `failed` or `skipped`. `ignored` lists findings the team already left out in `.prisme/security.yaml`, with the reason.

## Step 2: Check Each Finding in the Code

The base checks read lines, not meaning: some findings are false alarms. For each finding, from the most severe, open the file around the line and decide:

- **Real**: the problem can happen (for example a secret that looks real, `innerHTML` with text that can come from a user or from a file, a shell command built with a value from outside).
- **False alarm**: it cannot happen here (a fake key in a test, `innerHTML` with text already escaped, `eval` in a comment or a string). Say why in one sentence.
- **Unsure**: say what would make it real.

For many findings of the same rule (for example 15 `html-injection`), check a few representative ones and say so, rather than all of them.

For `vulnerable-dependency`, say whether the vulnerable package is used at runtime by the project or only in development, and what the fixed version is.

## Step 3: Explain

Talk to the user in the configured language, in this order:

1. **The grade and what it means**, in one or two sentences: A (nothing serious found), B (small things), C (one serious problem or several medium ones), D (a secret, a critical flaw, or many problems), E (several critical problems). Say that it comes from automatic checks, not from a full audit.
2. **What to fix first**: the real findings, most severe first, grouped when they share a rule. For each: what could happen, in everyday words (who could do what), where it is (`file:line`), and the fix in one or two sentences.
3. **False alarms**: the list, with the reason.
4. **What was not checked**: tools `missing` or `failed`. Installing them is optional and is the user's (or their company's) choice; only the person who runs `prisme security` needs them. Suggest, never install:
   - gitleaks (secrets, more patterns): `brew install gitleaks`
   - osv-scanner (vulnerable dependencies in every language): `brew install osv-scanner`
   - semgrep (risky code, deeper rules): `brew install semgrep` or `pipx install semgrep`

Adapt the words to the reader: a beginner needs the risk explained with an image (a key left under the doormat), a senior developer needs the rule, the place and the fix. When unsure, ask the user's level once.

## Step 4: Fix, With the User's Agreement

Propose the fixes as a short numbered list (most important first, with the effort: a line, a file, a refactoring) and ask which ones to do. Then fix only those.

- **A real secret** (`secret-in-code`, `env-committed`, `key-file-committed`): first tell the user to **revoke the key and create a new one** at the service that issued it; removing it from the code is not enough, it stays in the git history. Then move it to an environment variable (and `.env.example` without the value, `.env` in `.gitignore`). Do not rewrite git history unless the user asks; explain that it needs everyone to re-clone.
- **Dependencies**: update to the fixed version (`npm audit fix`, or the version given), then run the project's tests.
- **Code**: the smallest change that removes the risk (`execFile` with an argument list, query parameters, `textContent` or DOMPurify, `crypto.randomBytes`, `yaml.safe_load`, keep TLS checks on).

Never weaken a check to make the grade go up.

## Step 5: Record False Alarms (Optional)

If the user agrees, record the false alarms so they no longer count, in `.prisme/security.yaml` (create it or add to it; keep the existing entries):

```yaml
ignore:
  - rule: html-injection
    file: src/server/viewer.html   # a folder ends with /
    reason: "Every value goes through esc() before it is inserted."
  - rule: secret-in-code
    file: src/__tests__/fixtures/keys.ts
    line: 12                       # optional: only this line
    reason: "Fake key used by the tests."
```

`rule` and `reason` are required; a reader must understand the reason without you. Never ignore a real secret or a real vulnerable dependency.

## Step 6: Check Again

```bash
prisme security
```

Give the new grade, what changed, and what is left. Suggest `prisme view`: the Security page of the viewer (home screen, "Security score") shows each finding with why it matters, how to fix it, and a link to the element of the map that holds the file.
