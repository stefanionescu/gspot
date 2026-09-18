---
layer: code
preset: rules
title: Comments
---

# Comments

## Present state only

Comments and documentation describe what the code does right now. Never write `was removed`, `deleted`, `renamed`, `refactored`, or how the code `used to` work. No changelogs in comments.

Bad: `# Removed the old checkpoint loader.`
Good: `# Loads model checkpoints from the configured artifact directory.`

## Avoid referencing specific file paths

Comments and documentation must not reference specific file names or paths. File names change; hardcoding them creates stale references.

Exceptions: well-known configuration files such as `package.json` or
`pyproject.toml` may be mentioned by name when genuinely useful.

## Punctuation

Do not use em dashes or double hyphens. Use a space, comma, or colon instead.

Bad: `The server handles requests - including retries - before responding.`
Good: `The server handles requests, including retries, before responding.`

## Comments

Keep comments concise and focused on intent ("why"), not narration ("what"). Do not embed default values in comments; they drift when code changes. Reference concept names, not file paths.

Comments and doc comments must never contain:

- **Code change history.** No `changed X to Y`, `replaced old Z`, `updated to use W`, `refactored from`. Git tracks history.
- **What was done to variables or code.** No `added this field`, `moved this constant`, `renamed from oldName`. Describe the present purpose.
- **File or variable locations.** Do not say `defined in X.ts` or `see the value in config.Y` unless the reference is essential for understanding. Code is searchable; stale path references are not.

Good doc comments describe what a function does, what its parameters mean, and what it returns. They do not narrate how the function came to exist or what it replaced.

## Always comment

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

A `TODO` is a tracked, temporary marker with one format in every language:

```text
TODO(<issue-url-or-YYYY-MM-DD>): <sentence that says what changes and when>.
```

- The owner is an issue link or an expiry date. Never a person or a team.
- The sentence names the concrete change. "Clean this up later" is not a `TODO`.
- A `TODO` whose date has passed or whose issue is closed is a finding.
- `FIXME`, `XXX`, `HACK`, and untagged `TODO` are not accepted.

Good:

```python
# TODO(https://example.com/issues/123): Remove this branch when every export uses JSONL.
```

Bad:

```python
# TODO(alex): fix this
```
