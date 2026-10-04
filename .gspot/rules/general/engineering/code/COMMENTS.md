---
title: Comments
---

# Comments

## What a comment says

<!-- level: all -->

A comment explains why, not what, and describes the code as it is now.

Bad: `# Removed the old cache loader.`
Good: `# Loads cached responses from the configured cache directory.`

A doc comment says what a function does, what its parameters mean, and what it returns.

## When to comment

<!-- level: all -->

Write the doc comment that the language check asks for. Add other comments only when a function:

- handles a non-obvious failure
- has concurrency, cancellation, or isolation requirements
- makes a security or privacy decision
- encodes a domain invariant such as `idempotent` or `retry-safe`
- sits on a hot path
- takes more than ten seconds to understand from its signature and body

## Keep comments true

When you change a function, update its doc comment: summary, parameters, return value, and errors.
Rewrite or delete a comment that describes behavior the code lacks, or the reason for a decision
you are undoing.

## Deferred work

<!-- level: all -->

Track unfinished work in the issue tracker. Do not leave `TODO`, `FIXME`, `XXX`, or `HACK` in
comments. An issue link may explain an existing constraint, never promise a later implementation.
