---
title: Bash
---

# Bash

The Bash rules span five files. This one covers scope, files, structure, options, output,
comments, and formatting. Language covers functions, variables, quoting, arrays, conditionals,
arithmetic, loops, and paths. Safety covers commands, processes, network, secrets, temporary
files, security, and portability. Operations covers ownership, deployment, publishing, and CI.
Naming covers file, function, and variable names.

## Bash scope

<!-- level: all -->

Bash is glue code: it orchestrates commands and does not build application logic. Prefer
small scripts with explicit inputs, explicit outputs, and clear failure behavior.
Treat every path, argument, environment value, command output, and user input as unsafe until
quoted, validated, or parsed by a structured tool. A script that builds, deploys, deletes, or
publishes artifacts makes its inputs, effects, and failure behavior explicit.

`set -euo pipefail` does not replace checks around dangerous commands. Keep CI YAML and package
scripts short. Put longer logic in a script file the checks can lint.

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

The header declares the runtime contract, checked when `bash.platforms` is set:

```bash
#!/usr/bin/env bash
#
# Start the configured application server.
# Runtime: Bash 4.4+, Linux.
```

Use `macOS and Linux` only when the file is supported and reviewed on both.

### Shebangs

A newer Bash requirement names the minimum version and fails before any other work. Use
`#!/usr/bin/env bash` for repository scripts; use `#!/bin/bash` only when the target runtime
relies on system Bash at that path, such as a controlled Linux host. A `#!/bin/sh` file is
POSIX `sh`, and this file applies to it only in its quoting and security principles. SUID
and SGID are forbidden on shell scripts; use `sudo` or a platform privilege boundary.

Bash variables cannot hold NUL, so binary data
stays out of them, and command substitution loses trailing newlines where they matter.

## Runtime compatibility

The configuration requires Bash 4.4 or newer. The macOS system Bash is too old for these scripts.
Use a current Bash installation and state the minimum version in the `Runtime:` header. Check
`BASH_VERSINFO` before using features that require a newer version. Executable scripts enable
`set -euo pipefail` before their first command and add `shopt -s inherit_errexit`.

## Deprecated and forbidden syntax

Do not use `function`, `typeset`, `&>`, `|&`, or `for arg; {`. Use `name() { ...; }`,
`local`, `declare`, `readonly`, explicit redirections, and `for arg in "$@"; do` instead.
ShellCheck reports `$[ ... ]`, backticks, and `-a` or `-o` inside `[ ... ]`.
`trap ERR` is not general error handling. Check failure where it matters, and reserve traps
for cleanup that is safe on the relevant exit path.

## Script structure

<!-- level: all -->

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

Put recursive deletes in a script listed in `bash.safety_owners`. A function called in
`if`, `while`, `&&`, or `||` writes its checks inside because `errexit` does not stop it there:

```bash
# cleanup: Removes the contents of the target directory.
cleanup() {
  local target="$1"

  cd -- "${target}" || return 1
  find . -mindepth 1 -maxdepth 1 -exec rm -r -- {} +
}
```

Process substitution hides producer failures; when the producer matters, write to a checked
temporary file, use `PIPESTATUS`, or call the producer separately. Under `pipefail`, short
readers such as `head` and `grep -q` can make the producer see SIGPIPE and fail the pipeline;
consume input predictably or handle the known status. Under `nounset`, use `${name:-}` where
an unset variable is acceptable and `${name:?message}` for a required value at a clear
boundary. Use `${1:-}` where an argument may be missing.

## Output, logging, and errors

Write diagnostics with `printf`, not `echo`. Return or exit with the intended status: printing
an error does not make a command fail.

```bash
# log_status: Prints a timestamped diagnostic line to stderr.
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

A public, sourced, non-obvious, or risky function carries the full header with `Globals`,
`Arguments`, `Outputs`, and `Returns` sections.
