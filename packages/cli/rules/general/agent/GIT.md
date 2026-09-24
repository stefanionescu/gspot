---
layer: agent
configuration: rules
title: Git
---

# Git

## Protected files

Do not modify `AGENTS.md`, `CLAUDE.md`, or files under `rules/` unless the user
explicitly asks for rule changes.

## Working with uncommitted changes

When `git status` or the worktree shows changes you did not make, do not panic. Other agents or contributors may be working in parallel.

- Do not revert, stash, clean, or overwrite changes you did not make.
- Continue working if your changes do not conflict with uncommitted changes.
- Only stop and ask the user if a change you are about to make directly contradicts or overwrites an uncommitted worktree change.
- Build on top of uncommitted changes, or commit your own changes alongside them.
- If another agent is known to be committing those changes separately, leave them alone.

## Commits

- Commit only when the user asks.
- One change per commit. A rename and a behavior change are two commits.
- Conventional format: `<type>(<scope>): <subject>`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `perf`. The scope is required when the repository declares scopes.
- The subject is an imperative sentence under 72 characters, no trailing period, no ticket number.
- The body says what changed and why, wrapped at 72 columns. It does not narrate the diff.
- Footers reference issues (`Refs: #123`, `Closes: #123`) and breaking changes (`BREAKING CHANGE: ...`).
- Run the checks of the repository over the staged files before committing. Never bypass hooks
  with `--no-verify`.

## Branches

- Branch names are `<type>/<kebab-summary>`, such as `feat/order-export` or `fix/session-expiry`.
- Never force-push a protected branch. Force-push your own branch only after a rebase you performed.
- Rebase onto the default branch before opening a pull request; do not merge the default branch into a feature branch.

## What is never committed

- Secrets, credentials, `.env` files, local configuration.
- Generated output that the build produces (`dist/`, `coverage/`, caches).
- Dependencies (`node_modules/`, virtual environments).
- Binaries and media outside Git LFS.
- Editor state (`.vscode/` beyond the managed block, `xcuserdata/`, `.idea/`).

## Pull requests

- The title is the commit subject when the branch has one commit, otherwise a sentence for the whole change.
- The description states what changed, why, and how it was verified. It links the issue.
- A pull request does one thing. Unrelated fixes found on the way go in a separate branch.
