---
title: Comments
---

# Comments

## What a comment says

<!-- level: all -->

A comment explains why, not what, and describes the code as it is now.

- No history: not `was removed`, `renamed from`, `replaced old Z`, or the old behavior.
  Git keeps history.
- No file paths or variable locations, which go stale. Name the concept instead. A well-known
  file such as `package.json` may be named when it helps.
- No default values, which drift when the code changes.
- No em dashes or double hyphens as dashes; use a space, comma, or colon. The `--` before the
  reason of a suppression comment is syntax, not a dash.

Bad: `# Removed the old cache loader.`
Good: `# Loads cached responses from the configured cache directory.`

A doc comment says what a function does, what its parameters mean, and what it returns.

## When to comment

<!-- level: all -->

Comment a function that:

- handles a non-obvious failure
- has concurrency, cancellation, or isolation requirements
- makes a security or privacy decision
- encodes a domain invariant such as `idempotent` or `retry-safe`
- sits on a hot path
- takes more than ten seconds to understand from its signature and body

Do not comment code that is already obvious.

## Keep comments true

When you change a function, update its doc comment, its `@param` tags, and its `@returns`.
Rewrite or delete a comment that describes behavior the code lacks, or the reason for a decision
you are undoing.

## Deferred work

<!-- level: all -->

Track unfinished work in the issue tracker. Do not leave `TODO`, `FIXME`, `XXX`, or `HACK` in
comments. An issue link may explain an existing constraint, never promise a later implementation.
