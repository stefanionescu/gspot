---
layer: code
configuration: rules
title: Comments
---

# Comments

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Present state only

<!-- level: all -->

Comments and documentation describe what the code does right now. Never write `was removed`, `deleted`, `renamed`, `refactored`, or how the code `used to` work. No changelogs in comments.

Bad: `# Removed the old checkpoint loader.`
Good: `# Loads model checkpoints from the configured artifact directory.`

## Avoid referencing specific file paths

<!-- level: all -->

Comments and documentation must not reference specific file names or paths. File names change; hardcoding them creates stale references.

Exceptions: well-known configuration files such as `package.json` or
`pyproject.toml` may be mentioned by name when genuinely useful.

## Punctuation

<!-- level: all -->

Do not use em dashes or double hyphens. Use a space, comma, or colon instead.

Bad: `The server handles requests - including retries - before responding.`
Good: `The server handles requests, including retries, before responding.`

## Comments

<!-- level: all -->

Keep comments concise and focused on intent ("why"), not narration ("what"). Do not embed default values in comments; they drift when code changes. Reference concept names, not file paths.

Comments and doc comments must never contain:

- **Code change history.** No `changed X to Y`, `replaced old Z`, `updated to use W`, `refactored from`. Git tracks history.
- **What was done to variables or code.** No `added this field`, `moved this constant`, `renamed from oldName`. Describe the present purpose.
- **File or variable locations.** Do not say `defined in X.ts` or `see the value in config.Y` unless the reference is essential for understanding. Code is searchable; stale path references are not.

Good doc comments describe what a function does, what its parameters mean, and what it returns. They do not narrate how the function came to exist or what it replaced.

## Always comment

<!-- level: all -->

Regardless of language or visibility, add a comment when a function:

- Handles edge cases or non-obvious failure modes.
- Has concurrency, cancellation, or isolation requirements.
- Makes security or privacy decisions.
- Encodes domain invariants (`must be monotonic`, `idempotent`, `retry-safe`).
- Sits on a performance-sensitive hot path.
- Takes a reader more than ten seconds to understand from the signature and body alone.

The comment explains why, not what. Do not add comments only to satisfy a generic style preference
when the code is already obvious.

## Comment maintenance

When editing any file, check that comments and doc comments are still accurate. Stale comments are worse than no comments because they actively mislead.

- If you change a function's behavior, update its doc comment to match.
- If you change a function's parameters, update `@param` tags.
- If you change what a function returns, update `@returns`.
- If a comment references behavior the code lacks, rewrite or remove it.
- If a comment describes the "why" of a decision you are undoing, remove it.

## Deferred work

<!-- level: all -->

Track unfinished work in the issue tracker. Do not leave `TODO`, `FIXME`, `XXX`, or `HACK`
placeholders in source comments. An issue link can explain an existing constraint, but it
must not replace an explanation of current behavior or promise a later implementation.

Review the linked constraint when changing the affected code. Remove obsolete comments
with the code they describe.
