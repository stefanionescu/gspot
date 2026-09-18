---
layer: tool
preset: commits
title: Commit Messages
---

# Commit Messages

Enforced by commitlint at the commit-message hook.

- Format: `<type>(<scope>): <subject>`, then a blank line, then the body, then footers.
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`. No other
  type.
- The scope is required when the repository declares scopes and is one of them. It names the
  area changed, not the file.
- The subject is an imperative sentence in sentence case, under 72 characters, with no trailing
  period, no ticket number, and no emoji.
- The body explains what changed and why, wrapped at 72 columns. It does not narrate the diff or
  list files.
- Footers: `Refs: #123`, `Closes: #123`, `BREAKING CHANGE: <sentence>`. A breaking change also
  carries `!` after the type or scope.
- One logical change per commit. A commit that needs "and" in its subject is two commits.
- No `wip`, `fixup`, `tmp`, or `squash` commits reach the shared branch.
