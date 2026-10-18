---
title: What gspot does
description: See what gspot checks and how it fits your Git work.
---

gspot sets up linters, formatters, and security scanners for your repository and runs them before every commit.

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Each check runs a known tool, such as ESLint, Ruff, or ShellCheck, at one version everywhere.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks every push.
- **Writes rules for your agent.** `AGENTS.md` and one rule file for each language say how to write code that
  passes.

## What it flags

- Bugs and type errors
- Security problems and leaked secrets
- Vulnerable dependencies and licenses that you do not allow
- Formatting, broken links, and spelling
- Lint rules turned off without a reason
- At [level](/start/concepts/#levels) `all`: naming, structure, doc comments, duplication, and complexity

Continue with the [Quickstart](/start/quickstart/).
