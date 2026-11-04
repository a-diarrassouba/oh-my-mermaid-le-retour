# Security

## Reporting a flaw

Please do not open a public issue for a security flaw. Report it privately through GitHub's
[private vulnerability reporting](https://github.com/a-diarrassouba/oh-my-mermaid-le-retour/security/advisories/new),
with the steps to reproduce it and the version of prisme (`prisme --version`).

You will get an answer within a week. Once a fix is released, the report is published with credit to you, unless you prefer otherwise.

## What prisme does to stay safe

- The viewer (`prisme view`) only listens on `127.0.0.1` and only answers to `localhost`; actions that run something need a token handed to the page.
- Questions to Claude Code run with read-only tools confined to the project, never on `.env` files or keys.
- `prisme security` checks a project without AI and never stores a secret in its report.
