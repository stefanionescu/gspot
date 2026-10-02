---
title: Commit Messages
---

# Commit Messages

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Commit format

<!-- level: all -->

Follow the repository's declared commit-message policy.

- Format: `<type>(<scope>): <subject>`, then a blank line, then the body, then footers.
- Use a type the repository allows. Common types include `feat`, `fix`, `refactor`, `perf`,
  `docs`, `test`, `build`, `ci`, and `chore`.
- The scope is required when the repository declares scopes and is one of them. It names the
  area changed, not the file.
- The subject is an imperative sentence with no trailing period, ticket number, or emoji.
  Keep the complete header, including type and scope, within the configured length limit.
- The body explains what changed and why, wrapped at 72 columns. It does not narrate the diff or
  list files.
- Footers: `Refs: #123`, `Closes: #123`, `BREAKING CHANGE: <sentence>`. A breaking change also
  carries `!` after the type or scope.
- One logical change per commit. A commit that needs "and" in its subject is two commits.
- No `wip`, `fixup`, `tmp`, or `squash` commits reach the shared branch.
