---
layer: code
configuration: rules
title: Command-Line Programs
---

# Command-Line Programs

Rules for any executable a person or a script invokes, in every language.

## Streams and exit status

- Data goes to stdout. Diagnostics, progress, prompts, and errors go to stderr.
- Exit `0` on success, `1` on failure, `2` on usage error. A specific non-zero code for a specific
  outcome is documented.
- Machine-readable output (`--json`) is complete, stable, and free of progress text.
- No color or terminal control sequences when stdout is not a terminal or `NO_COLOR` is set.

## Interface

- `--help` prints usage, every flag with its default, and one example. `--version` prints the
  version and exits.
- Flags are `--kebab-case`. A boolean flag has no value; a negation is `--no-flag`.
- Required inputs are arguments or flags, never interactive prompts. A prompt is allowed only
  when stdin is a terminal and `--yes` or `--no-input` skips it.
- A destructive command asks for confirmation on a terminal and requires `--yes` otherwise.
- Read secrets from the environment or a file, never from a flag that lands in the process table.

## Behavior

- Validate every argument before doing any work. Fail with an actionable message that names the
  argument.
- Idempotent where the operation allows it: running twice produces the same state.
- Long operations report progress on stderr and honor interruption: catch the termination signal,
  clean up, exit with the signal's status.
- The working directory is never assumed. Resolve paths against the repository root or an explicit
  argument.
- Temporary files are created safely, registered for cleanup on exit, and never predictable in a
  shared directory.
