---
title: Introduction
description: See what gspot checks and how it fits your Git work.
---

gspot sets up linters, formatters, and security scanners for your repository and runs them before every commit.

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Every tool runs at one version on every machine and in CI, so a check that passes for you passes
  for everyone.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks every push.
- **Writes rules for your agent.** `AGENTS.md` lists rule files for your languages, frameworks, and level. They say
  how to write code that passes the checks.

## What it flags

- Bugs and type errors
- Security and accessibility problems, and leaked secrets
- Vulnerable dependencies and licenses that you do not allow
- Formatting, broken links, and spelling
- Lint rules turned off without a reason
- At [level](/start/concepts/#levels) `all`: naming, wording, structure, doc comments, duplication, and complexity

Continue with the [Quickstart](/start/quickstart/).
