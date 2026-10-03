---
title: Bash
---

# Bash

The Bash rules span four files. This one covers scope, files, structure, options, output,
comments, and formatting. Language covers functions, variables, quoting, arrays, conditionals,
arithmetic, loops, and paths. Safety covers commands, processes, network, secrets, temporary
files, security, and portability. Operations covers ownership, deployment, publishing, and CI.

## Core Bash philosophy

<!-- level: all -->

Bash is glue code: it orchestrates commands and does not build application logic. Prefer
small, boring scripts with explicit inputs, explicit outputs, and clear failure behavior.
Treat every path, argument, environment value, command output, and user input as unsafe until
quoted, validated, or parsed by a structured tool. A script that builds, deploys, deletes, or
publishes artifacts makes its inputs, effects, and failure behavior explicit.

`set -euo pipefail` is not a substitute for checking dangerous commands. Do not hide
deployment or artifact lifecycle behavior in package scripts or CI YAML: move non-trivial
orchestration into a reviewed Bash script, not another scripting language. If the logic is
too complex for Bash, simplify the workflow, split it, or move the behavior into
product-owned application code as a deliberate feature change.

Good:

```bash
#!/usr/bin/env bash
#
# Count lines in a caller-selected readable file.
# Runtime: Bash 3.2+, macOS and Linux.

set -euo pipefail

# main - Validate the input and print its line count.
main() {
  local input_file="${1:-}"
  if [[ ! -f ${input_file} || ! -r ${input_file} ]]; then
    printf 'error: a readable input file is required\n' >&2
    return 1
  fi
  wc -l <"${input_file}"
}

main "$@"
```

## When to use Bash

<!-- level: all -->

Use Bash when the script mostly calls other command-line tools or wires together
installation, lint, build, runtime, publication, or cleanup steps. Use it to validate the
environment and dispatch to project commands, or for simple file movement, process checks,
and retry loops. Do not use Bash for business logic or complex text parsing. Do not use it
for JSON, YAML, XML, or HTML transformations beyond simple extraction with a dedicated
parser. Large mutable data structures, long-lived daemons, high-performance work,
security-sensitive parsing of untrusted input, and behavior that needs typed contracts belong
elsewhere. A workflow that needs nested maps, large
arrays, state machines, non-trivial validation, complex retries, concurrent work, or domain
rules is too big for a script.

## File types and invocation

An executable script starts with a Bash shebang, is executable and directly invoked, and is
never sourced by another repository script. A library is not executable and is safe to
`source` without running program behavior. It has no `main` function or `main "$@"` call,
never enables or disables shell options, and never calls `exit`. It performs no workflow
step, process start, state mutation, or deletion while loading. A configuration library may assign documented
configuration values while loading; other libraries only declare readonly owner constants,
source direct dependencies, and define functions. A file is exactly one of the two.

### Entrypoint conventions

<!-- level: all -->

The header declares the runtime contract, checked when `tools.bash.platforms` is set:

```bash
#!/usr/bin/env bash
#
# Start the configured application server.
# Runtime: Bash 3.2+, Linux.
```

### Shebangs and encoding

Use `macOS and Linux` only when the file is supported and reviewed on both. A newer Bash
requirement names the minimum version and fails before any other work. Use
`#!/usr/bin/env bash` for repository scripts; use `#!/bin/bash` only when the target runtime
relies on system Bash at that path, such as a controlled Linux host. A `#!/bin/sh` file is
POSIX `sh`, and this file applies to it only in its quoting and security principles. SUID
and SGID are forbidden on shell scripts; use `sudo` or a platform privilege boundary.

Store Bash files as UTF-8 without a byte-order mark and with LF endings; a BOM before `#!`
breaks execution the way a broken shebang does. Bash variables cannot hold NUL, so binary data
stays out of them, and command substitution loses trailing newlines where they matter.

## Runtime compatibility

macOS ships Bash 3.2, and the `Runtime:` line is the contract. A file declaring `Bash 3.2+`
uses only features of that version. A newer minimum permits the features of that minimum
alone. Bash 3.2 lacks associative arrays, `readarray` and `mapfile`, `globstar`, namerefs,
`${var@Q}` and the newer parameter transformations, `coproc`, `BASH_XTRACEFD`, `wait -n`,
`local -n`, and `shopt -s lastpipe`. A script that requires a newer Bash checks
`BASH_VERSINFO[0]` first and fails with a message. Executable scripts enable
`set -euo pipefail` before their first command, and scripts declaring Bash 4.4+ add
`shopt -s inherit_errexit`.

## Deprecated and forbidden syntax

ShellCheck reports the old spellings: `$[ ... ]` for `$(( ... ))`, backticks for `$(...)`,
`let` for `(( ... ))`, `typeset` for `local`, `declare`, `readonly`, or `export`, the
`function` keyword for `name() { ...; }`, `for arg; { ...; }` for `for arg in "$@"; do`,
`&>file` and `>&file` for `>file 2>&1`, `cmd |& other` for `cmd 2>&1 | other`, and `-a` or
`-o` inside `[ ... ]` for `[[ ... ]]`, explicit `if` branches, or `case`. Two forms are
design decisions rather than lint findings. `trap ERR` is not general error handling, so
failure is checked where it matters and traps run only cleanup that is safe on the relevant
exit path. `eval` never turns strings into code, so dispatch uses arrays, direct validation,
`case`, or fixed tables.

## Script structure

<!-- level: all -->

A file runs shebang, file header, shell options, `source` statements, constants, exported
configuration, functions, `main`, and `main "$@"` as the last non-comment line. Private
functions (prefixed `_`, called from no other file) come before the functions other files
source, and `main` comes last. No executable program flow sits between function definitions,
and a library mutates no global state while loading unless that mutation is its documented
purpose. Source files by explicit paths built from `BASH_SOURCE[0]`, never from the caller's
directory, and source every function dependency directly rather than through a barrel.

An executable script finishes with a meaningful status: a final diagnostic command, a false
condition, or an optional cleanup check must not become the script status by accident. Use
an explicit `exit 0` only when the final command's status is not the program result and
success is already established.

## Shell options

`set -euo pipefail` is the entrypoint default, used only when the script is written and
reviewed for those semantics. `errexit` is a backstop, not control flow: it has exceptions in
conditionals, pipelines, command substitutions, subshells, and functions, so `cd`, `rm`,
builds, publishing, uploads, and destructive commands are checked explicitly. Do not toggle
options around a small operation without restoring the prior state. Do not change `IFS` as a
strict-mode ritual; set it locally where reading or joining data requires it. Keep `set -x`
out of committed code.

A function called in `if`, `while`, `&&`, or `||` writes its checks inside, because `errexit`
does not stop it there:

```bash
# cleanup - Removes the contents of the target directory.
cleanup() {
  local target="$1"

  cd -- "${target}" || return 1
  rm -rf ./*
}
```

Command substitution inside another command's arguments does not stop the script when the
producer fails, and `local`, `export`, `readonly`, and `declare` mask the substitution status.
Declare first, then assign and check:

```bash
version="$(generate_version)" || return 1
printf 'version=%s\n' "${version}"
```

Process substitution hides producer failures; when the producer matters, write to a checked
temporary file, use `PIPESTATUS`, or call the producer separately. Under `pipefail`, short
readers such as `head` and `grep -q` can make the producer see SIGPIPE and fail the pipeline;
consume input predictably or handle the known status. Under `nounset`, use `${name:-}` where
an unset variable is acceptable and `${name:?message}` for a required value at a clear
boundary. Use `${1:-}` where an argument may be missing, and guard array access explicitly in
Bash 3.2 scripts.

## Output, logging, and errors

STDOUT is for output another command may consume; STDERR is for status, warnings, prompts,
and errors. Write diagnostics with `printf`, not `echo`, at the operation that owns the
failure, and return or exit with the intended status, because printing an error does not make
a command fail. Machine-readable output excludes progress text, and no parser depends on
human log text. Long-running, cron, publishing, and multi-target scripts print timestamped
diagnostics with stable fields (script, step, target, attempt, status) instead of prose
progress. Never print secrets, tokens, cookies, connection strings, `.env` content, or provider
payloads. Use colored output in CI only where the runner and logs support it, and `logger` or
journald only in Linux-only scripts that check for the command.

```bash
# log_status - Prints a timestamped diagnostic line to stderr.
# Arguments:
#   Step name.
#   Target name.
#   Status label.
log_status() {
  local step_name="$1"
  local target_name="$2"
  local status_label="$3"
  local timestamp

  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" || return 1
  printf 'ts=%s script=%s step=%s target=%s status=%s\n' \
    "${timestamp}" "${0##*/}" "${step_name}" "${target_name}" \
    "${status_label}" >&2
}
```

## Comments and documentation

<!-- level: all -->

Every file starts with a short header after the shebang. Every function carries the one-line
header the doc-comment check reads, as the examples above show. A function that is public, sourced by other files, non-obvious,
or risky carries the full header with `Globals`, `Arguments`, `Outputs`, and `Returns`
sections. Comments document behavior, not history. They explain why a shell pattern is needed
when the code is not obvious, and they do not narrate every line.

Track unfinished work in the issue tracker, not in a `TODO` comment. A suppression explains the real constraint and stays as narrow as possible.

## Review checklist

<!-- level: all -->

Before running the checks of the repository, read the change for what they cannot see.

- The script uses Bash only where Bash is intended and is exactly one invocation type.
- Shell options mask no missing check, and the final status is meaningful.
- Argument lists use arrays, and external data is validated before arithmetic or command use.
- No `eval`, configured `bash -c`, parsed `ls`, or untrusted shell fragment exists.
- Destructive commands, uploads, and directory changes have explicit failure handling.
- Temporary files come from `mktemp` and are cleaned up, and locks are atomic.
- Retries and background jobs are bounded and tracked, and secrets are never printed.
- Unusual filenames, broken symlinks, and no-match globs are handled.
- Network and readiness commands have bounded timeouts.
