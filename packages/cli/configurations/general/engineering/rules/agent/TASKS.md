---
title: Task Runner
---

# Task Runner

Rules for `mise` tasks, `package.json` scripts, `Makefile` targets, or the project's runner.

## Task contracts

- Reuse the task names the project has. Add a task only when asked.
- Do not add empty section markers or scripts that only echo a placeholder.
- A required command failure stops dependent work and produces a nonzero task status.

## Task organization

<!-- level: all -->

- Use one declared task runner per project.
- Name tasks in kebab-case with a colon namespace, such as `check:fix` or `deploy:staging`.
- Use the runner's declarative commands and dependency ordering. Keep substantial parsing,
  branching, and process control in the code that owns that behavior.
- Give each task a concise description in the runner's task list.
