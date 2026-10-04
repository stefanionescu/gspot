---
title: Git
---

# Git

## Working with uncommitted changes

Changes you did not make may belong to another agent or contributor working in parallel. Do not
revert, stash, clean, or overwrite them. Keep working beside them, and ask the user only when your
change overwrites or contradicts one.

## Commits

- Commit only when the user asks.
- One change per commit. A rename and a behavior change are two commits.
- The body says what changed and why.
- Footers reference issues (`Refs: #123`, `Closes: #123`) and breaking changes (`BREAKING CHANGE: ...`).
- Never bypass hooks with `--no-verify`.

## Branches

- Branch names are `<type>/<kebab-summary>`, such as `feat/order-export` or `fix/session-expiry`.
- Never force-push a protected branch. Force-push your own branch only after a rebase you performed.
- Rebase onto the default branch before opening a pull request; do not merge the default branch into a feature branch.

## What is never committed

- Editor state (`.vscode/`, `.idea/`, `xcuserdata/`), except settings the team commits on purpose.

## Pull requests

- The title is the commit subject when the branch has one commit, otherwise a sentence for the whole change.
- The description states what changed, why, and how it was verified. It links the issue.
- A pull request does one thing. Unrelated fixes found on the way go in a separate branch.
