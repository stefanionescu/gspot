---
layer: tool
preset: config-files
title: Task Runner
---

# Task Runner

Rules for the repository's task surface: `mise` tasks, `package.json` scripts, `Makefile`
targets, or whichever runner the repository declares.

- One runner is the surface. Every command a person runs is a task there, named in kebab-case
  with a colon namespace (`check`, `check:fix`, `build`, `dev`, `deploy:staging`). `enforced-by: integrity/task-policy`
- A task is a wrapper: it calls the tool or the script with fixed arguments. Logic longer than
  one command lives in a script that follows the shell rules. `enforced-by: integrity/task-policy`
- The required tasks exist in every repository: `check` (runs `gspot check`), `check:fix`,
  `build` where there is a build, `dev` where there is a server, `test` where there are tests. `enforced-by: integrity/task-policy`
- `package.json` scripts in the root manifest are limited to the approved wrapper set the
  repository configures; a non-root package never wraps `mise run`. No section-marker scripts
  (`"---": ""`), no scripts that only echo. `enforced-by: integrity/task-policy`
- `bun run X`, `npm run X`, and `mise run X` in documentation, hooks, and CI name a task that
  exists. `enforced-by: integrity/task-policy`
- A task that needs a tool declares it through the runner's tool pins; nothing is installed ad hoc
  inside a task. `enforced-by: integrity/task-policy`
- Tasks are idempotent and safe to rerun. A destructive task (`db:reset`, `clean:all`) says so in
  its description and asks for confirmation on a terminal. `enforced-by: integrity/task-policy`
- Every task has a one-sentence description shown by the runner's list command. `enforced-by: integrity/task-policy`
