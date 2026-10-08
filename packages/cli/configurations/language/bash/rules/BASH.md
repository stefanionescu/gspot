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

## Values

Bash variables cannot hold NUL, so binary data
stays out of them, and command substitution loses trailing newlines where they matter.

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

## Options

`errexit` is a backstop, not control flow: it has exceptions in
conditionals, pipelines, command substitutions, subshells, and functions, so `cd`, `rm`,
builds, publishing, uploads, and destructive commands are checked explicitly. Do not toggle
options around a small operation without restoring the prior state. Do not change `IFS` as a
strict-mode ritual; set it locally where reading or joining data requires it. Keep `set -x`
out of committed code.

A function called in
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
