---
layer: code
kit: rules
title: Command-Line Programs
---

# Command-Line Programs

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules for any executable a person or a script invokes, in every language.

## Streams and exit status

- Data goes to stdout. Diagnostics, progress, prompts, and errors go to stderr.
- Preserve established exit codes. New commands use `0` on success, `1` on failure, and `2`
  on usage error unless their protocol defines another contract. Document specific outcomes.
- Machine-readable output (`--json`) is complete, stable, and free of progress text.
- No color or terminal control sequences when stdout is not a terminal or `NO_COLOR` is set.

## Interface

- `--help` prints usage, every flag with its default, and one example. `--version` prints the
  version and exits.
- Required inputs have an argument, flag, or declared configuration source for automation.
  Interactive prompts require a terminal; noninteractive execution reports missing inputs
  instead of waiting for an answer.
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

## Flag naming

<!-- level: all -->

Use `--kebab-case` for flags. Boolean switches take no value; use `--no-flag` for negation.
Preserve names owned by an existing public interface.
