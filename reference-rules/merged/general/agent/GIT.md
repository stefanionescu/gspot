---
layer: agent
preset: rules
title: Git
---

# Git

## Protected Files

Do not modify `AGENTS.md`, `CLAUDE.md`, or files under `rules/` unless the user `unenforced`
explicitly asks for rule changes.

## Working With Uncommitted Changes

When `git status` or the worktree shows changes you did not make, do not panic. Other agents or contributors may be working in parallel.

- Do not revert, stash, clean, or overwrite changes you did not make. `unenforced`
- Continue working if your changes do not conflict with uncommitted changes. `unenforced`
- Only stop and ask the user if a change you are about to make directly contradicts or overwrites an uncommitted worktree change. `unenforced`
- Build on top of uncommitted changes, or commit your own changes alongside them. `unenforced`
- If another agent is known to be committing those changes separately, leave them alone. `unenforced`

## Commits

- Commit only when the user asks. `unenforced`
- One change per commit. A rename and a behavior change are two commits. `unenforced`
- Conventional format: `<type>(<scope>): <subject>`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `perf`. The scope is required when the repository declares scopes. `enforced-by: commits/commitlint`
- The subject is an imperative sentence under 72 characters, no trailing period, no ticket number. `enforced-by: commits/commitlint`
- The body says what changed and why, wrapped at 72 columns. It does not narrate the diff. `enforced-by: commits/commitlint`
- Footers reference issues (`Refs: #123`, `Closes: #123`) and breaking changes (`BREAKING CHANGE: ...`). `enforced-by: commits/commitlint`
- Run `gspot check --staged` before committing. Never bypass hooks with `--no-verify`. `enforced-by: integrity/task-policy`

## Branches

- Branch names are `<type>/<kebab-summary>`, such as `feat/order-export` or `fix/session-expiry`. `enforced-by: commits/commitlint`
- Never force-push a protected branch. Force-push your own branch only after a rebase you performed. `unenforced`
- Rebase onto the default branch before opening a pull request; do not merge the default branch into a feature branch. `unenforced`

## What Is Never Committed

- Secrets, credentials, `.env` files, local configuration. `enforced-by: integrity/env-files`
- Generated output that the build produces (`dist/`, `coverage/`, caches). `unenforced`
- Dependencies (`node_modules/`, virtual environments). `unenforced`
- Binaries and media outside Git LFS. `enforced-by: integrity/large-files`
- Editor state (`.vscode/` beyond the managed block, `xcuserdata/`, `.idea/`). `unenforced`

## Pull Requests

- The title is the commit subject when the branch has one commit, otherwise a sentence for the whole change. `enforced-by: commits/commitlint`
- The description states what changed, why, and how it was verified. It links the issue. `unenforced`
- A pull request does one thing. Unrelated fixes found on the way go in a separate branch. `unenforced`
