---
layer: tool
kit: configs
title: Task Runner
---

# Task Runner

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules for the repository's task surface: `mise` tasks, `package.json` scripts, `Makefile`
targets, or whichever runner the repository declares.

## Task contracts

- Required project tasks exist: `check`, `check:fix`, `build` where there is a build,
  `dev` where there is a server, and `test` where there are tests.
- Enforce the repository's declared wrapper policy for package scripts. Do not add empty
  section markers or scripts that only echo a placeholder.
- Commands named in documentation, hooks, and CI must exist in the selected runner.
- Declare each task's tool prerequisites. Keep installation in the setup task that owns it.
- A required command failure stops dependent work and produces a nonzero task status.
- Make rerunnable tasks idempotent where their operation permits it. Destructive tasks
  identify their effect and require the confirmation or automation authorization their
  contract defines.

## Task organization

<!-- level: all -->

- Use one declared task surface per project. Preserve separate workspace installation boundaries.
- Name tasks in kebab-case with a colon namespace, such as `check:fix` or `deploy:staging`.
- Use the runner's declarative commands and dependency ordering. Keep substantial parsing,
  branching, and process control in the code that owns that behavior.
- Give each task a concise description in the runner's task list.
