---
layer: language
configuration: bash
title: Bash
---

# Bash

The Bash rules span four files. This one covers scope, files, structure, options, output, comments,
and formatting. Language covers functions, variables, quoting, arrays, conditionals, arithmetic,
loops, and paths. Safety covers commands, processes, network, secrets, temporary files, security,
and portability. Operations covers ownership, deployment, publishing, and CI.

## Core Bash philosophy

Rules:

- Bash is glue code. Use it to orchestrate commands, not to build complex
  application logic.
- Prefer small, boring scripts with explicit inputs, explicit outputs, and clear
  failure behavior.
- Treat every path, argument, environment value, command output, and user input
  as unsafe until quoted, validated, or parsed by a structured tool.
- A script that quantizes models, builds engines, starts runtime services,
  publishes artifacts, deletes artifacts, uploads models, or changes secrets
  must be readable enough to audit line by line.
- ShellCheck warnings are design feedback. Fix them unless there is a documented
  reason not to.
- `set -euo pipefail` is not a substitute for checking dangerous commands.
- Do not hide quantization, engine-build, publishing, runtime, or artifact
  behavior in package scripts or CI YAML. Move non-trivial orchestration into a
  reviewed Bash script.
- When writing shell orchestration, write Bash. Do not create another scripting
  language file as an escape hatch for shell work.
- If scripting logic is too complex for Bash, simplify the workflow or split it into smaller
  scripts. Otherwise, move the behavior into product-owned application code as part of a deliberate
  feature change.

Good Bash:

```bash
#!/usr/bin/env bash
#
# Validate the configured model before starting the runtime.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1
readonly SCRIPT_DIR

# fail - Prints a fatal error and exits.
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

main() {
  [[ -n "${MODEL:-}" ]] || fail 'MODEL is required'
  python -m src.scripts.validate
}

main "$@"
```

## When to use Bash

Use Bash when the script mostly:

- calls other command-line tools;
- wires together install, lint, quantization, engine-build, runtime, publish,
  or cleanup steps;
- validates environment and then dispatches to project commands;
- performs simple file movement, process checks, or retry loops.

Do not use Bash for:

- complex business logic;
- complex text parsing;
- JSON, YAML, XML, or HTML transformations beyond simple extraction with a
  dedicated parser;
- large mutable data structures;
- long-lived daemons;
- high-performance work;
- security-sensitive parsing of untrusted input;
- behavior that needs typed contracts.

Do not create non-Bash scripts as an escape hatch. A workflow that needs nested maps, large arrays,
state machines, non-trivial validation, complex retries, concurrent work, or domain rules is too big
for a script. Reduce the scripting scope or implement the behavior in the owning application code.

## File types and invocation

Executable scripts:

- Must start with a Bash shebang.
- Must be executable and directly invoked.
- Must own a `main` function and finish with `main "$@"`, except for
  externally defined hook and task entrypoints whose manager owns the
  invocation contract.
- Must not be sourced by another repository script.

Libraries:

- Keep library files non-executable.
- Must be safe to `source` without running main program behavior.
- Must not contain a `main` function or a `main "$@"` call.
- Must not enable or disable shell options.
- Must not call `exit`.
- Must not perform workflow steps, start processes, mutate runtime state, or
  delete files while loading.
- Configuration libraries may assign documented configuration values while
  loading. Other libraries may only declare readonly owner constants, source
  direct dependencies, and define functions.

Every file declares its runtime contract in the header:

```bash
#!/usr/bin/env bash
#
# Start the configured inference server.
# Runtime: Bash 3.2+, Linux.
```

Use `macOS and Linux` only when the file is supported and reviewed on both
platforms. A newer Bash requirement must name the minimum version and fail
before any other work.

Shebang rules:

```bash
#!/usr/bin/env bash
```

Use this for repo scripts that may run on macOS, Linux, CI, or developer
machines.

```bash
#!/bin/bash
```

Use this only when the target runtime deliberately relies on system Bash at that
path, such as a controlled Linux remote host.

Do not use:

```bash
#!/bin/sh
#!/usr/bin/env sh
```

unless the file is intentionally POSIX `sh`. If a file uses `sh`, this Bash
guide does not apply except for general quoting and security principles.

SUID and SGID are forbidden on shell scripts. Use `sudo` or a platform-specific
privilege boundary instead.

## File encoding and line endings

Rules:

- Store Bash files as UTF-8 without a byte-order mark.
- Use LF line endings. Do not commit CRLF shell scripts.
- Do not put binary data in shell variables. Bash variables cannot contain NUL.
- Do not use command substitution for content where exact trailing newlines
  matter.
- Keep generated shell snippets free of invisible prefix bytes before the
  shebang.

If a script has Windows line endings, convert it before review:

```bash
tr -d '\r' < "${script}" > "${script}.tmp"
mv -- "${script}.tmp" "${script}"
```

A file that starts with a BOM before `#!` may fail to execute as a script. Treat
that the same as a broken shebang.

## Runtime compatibility

macOS ships Bash 3.2 by default. The header's `Runtime:` line is the contract. A file
declaring `Bash 3.2+` uses only features available in that version. A newer minimum
version permits features available at that minimum; Bash 4.0 does not imply
support for all Bash 4 or Bash 5 features. Reject an older runtime before other work.

Executable scripts enable `set -euo pipefail` before their first command. Scripts
declaring Bash 4.4+ also enable `shopt -s inherit_errexit`. Do not use
that option with an earlier declared minimum.

Bash 3.2 lacks these features:

- associative arrays;
- `readarray` and `mapfile`;
- `globstar`;
- namerefs with `declare -n`;
- `${var@Q}` and other newer parameter transformations;
- `coproc`;
- `BASH_XTRACEFD`;
- `wait -n`;
- `local -n`;
- `shopt -s lastpipe`;
- process-substitution behavior that has not been verified on the target OS.

If a script requires a newer Bash:

```bash
require_bash_4() {
  if (( BASH_VERSINFO[0] < 4 )); then
    printf 'error: bash 4 or newer is required\n' >&2
    return 1
  fi
}
```

State the requirement in the file header and fail before doing work.

## Deprecated and forbidden syntax

Use the modern, explicit Bash form even when an older spelling still works.

Forbidden forms:

- Arithmetic expansion: do not use `$[ ... ]`. Use `$(( ... ))`.
- Command substitution: do not use backtick substitution. Use `$(...)`.
- Arithmetic command: do not use `let`. Use `(( ... ))` or assignment with
  `$(( ... ))`.
- Declarations: do not use `typeset`. Use `local`, `declare`, `readonly`, or
  `export` according to the value's real scope.
- Function definitions: do not use the `function` keyword, including
  `function name()`, `function name() { ... }`, or `function name { ... }`.
  Use `name() { ...; }`.
- Compact loop syntax: do not use `for arg; { ...; }`. Use
  `for arg in "$@"; do ... done`.
- Combined redirection shortcuts: do not use `&>file` or `>&file`. Use
  `>file 2>&1`.
- Combined pipeline shorthand: do not use `cmd |& other`. Use
  `cmd 2>&1 | other`.
- Test composition: do not use `test -a`, `test -o`, `[ ... -a ... ]`,
  `[ ... -o ... ]`, or grouping operators inside `[ ... ]`. Use `[[ ... ]]`,
  explicit `if` branches, or `case`.
- `ERR` traps: do not use `trap ERR` as general error handling. Use explicit
  status checks where failure matters, and reserve traps for cleanup that is
  safe to run on the relevant exit path.
- `eval`: do not use casual `eval` to turn strings into code. Use arrays,
  direct validation, `case`, or fixed dispatch tables.

Good:

```bash
run() {
  if [[ "${mode}" == 'publish' || "${mode}" == 'cleanup' ]]; then
    count=$(( count + 1 ))
    command >"${log_file}" 2>&1
  fi
}
```

## Script structure

Order files like this:

1. Shebang.
2. File header comment.
3. Shell options.
4. `source` statements.
5. Constants and exported configuration.
6. Functions: private functions (prefixed `_`, called from no other file) first, then the
   functions other files source, then `main`.
7. `main`.
8. `main "$@"` as the last non-comment line for executable scripts.

Example:

```bash
#!/usr/bin/env bash
#
# Run one runtime pipeline step from the repository root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1
readonly SCRIPT_DIR

REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)" || exit 1
readonly REPO_ROOT

source "${SCRIPT_DIR}/lib/log.sh"

# require_model_dir - Validates that the model directory exists.
# Arguments:
#   Model directory path.
# Returns:
#   0 when the directory exists, non-zero otherwise.
require_model_dir() {
  local model_dir="$1"

  [[ -d "${model_dir}" ]]
}

main() {
  local model_dir="${1:-}"

  require_model_dir "${model_dir}" || {
    printf 'error: model directory is required\n' >&2
    return 1
  }

  PYTHONPATH="${REPO_ROOT}/src:${REPO_ROOT}" python -m tests.cli \
    --model-path "${model_dir}"
}

main "$@"
```

Rules:

- Every `_`-prefixed function is defined above the first function without the prefix. A
  function sourced by another file has no prefix; a function used only in its own file has one.
  `main` is exempt.
- Do not put executable program flow between function definitions.
- Do not mutate global state while loading a library unless that mutation is the
  documented purpose of the library.
- Source files with explicit paths based on `BASH_SOURCE[0]`, not the caller's
  current directory.
- Libraries may define constants, functions, and validation helpers. Entrypoints
  own argument parsing and `main`.
- Executable scripts must finish with a meaningful program status. Do not let a
  final diagnostic command, false condition, or optional cleanup check become
  the script status by accident.
- Use explicit `exit 0` only when the final command's status is not the program
  result and success has already been established.

## Shell options

Use shell options deliberately.

Common entrypoint default:

```bash
set -euo pipefail
```

Rules:

- Use `set -euo pipefail` only when the script is written and reviewed for those
  semantics.
- Do not rely on `errexit` for critical safety. Explicitly check `cd`, `rm`,
  quantization, engine-build, runtime, publishing, upload, and destructive
  commands.
- Treat `errexit` as a backstop, not control flow. It has exceptions in
  conditionals, pipelines, command substitutions, subshells, and functions.
- Do not enable shell options in sourced libraries unless the library is part of
  a script family that already owns those options.
- Do not toggle options globally around a small operation without restoring the
  prior state.
- Sourced libraries must not call `set` at all. Capture command status with
  `if`, `if !`, or an explicit conditional command instead.
- Do not change `IFS` as part of a fake strict-mode ritual. Set `IFS` locally
  only where reading or joining data requires it.
- Avoid `set -x` in committed code. If temporary tracing is necessary, keep it
  local and make sure secrets cannot be printed.

`errexit` pitfalls:

```bash
# Bad: this can keep running when called in a conditional context.
cleanup() {
  cd "${1}"
  rm -rf ./*
}

cleanup "${target}" || exit 1
```

Functions, subshells, and groups behave differently when their caller checks
their status. When a function may be called in `if`, `while`, `&&`, or `||`,
write explicit checks inside the function instead of assuming `errexit` will
stop at the first failing command.

```bash
# Good: failure is explicit where it matters.
cleanup() {
  local target="$1"

  cd -- "${target}" || return 1
  rm -rf ./*
}
```

Command substitution inside another command's arguments does not reliably stop
the script:

```bash
# Bad: printf can succeed even when generate_version fails.
printf 'version=%s\n' "$(generate_version)"
```

```bash
# Good: the producer status is checked before the value is consumed.
version="$(generate_version)" || return 1
printf 'version=%s\n' "${version}"
```

`local`, `export`, `readonly`, and `declare` can mask command-substitution
failures. Declare first, then assign and check the command status.

Process substitution hides producer failures from the consumer's status:

```bash
# Risky: sort can succeed even when generate_lines fails.
sort < <(generate_lines)
```

When the producer matters, write to a checked temporary file, use a checked
pipeline with `PIPESTATUS`, or call the producer separately.

`pipefail` pitfalls:

```bash
# Risky with pipefail: grep -q can exit early and make the producer see SIGPIPE.
if produce_large_output | grep -q 'ready'; then
  printf 'ready\n'
fi
```

Prefer a command that consumes input predictably, or handle the known status
explicitly. Short readers such as `head`, `grep -q`, and commands that stop
after the first match can create false failures under `pipefail`.

`nounset` rules:

- Do not enable `set -u` blindly in an existing script. The script must be
  reviewed for unset positional parameters, optional environment variables, and
  arrays.
- Use `${name:-}` when an unset variable is acceptable.
- Use `${name:?message}` for required configuration at a clear boundary.
- Do not use unguarded `${1}` when an argument may be missing. Use `${1:-}`.
- Be careful with arrays under `set -u`; check lengths before indexing.
- If empty arrays are meaningful, require Bash 4.4+ before relying on
  their behavior under `set -u`. Bash 3.2-compatible scripts must guard array
  access explicitly.

## Output, logging, and errors

STDOUT is for script output that another command may consume. STDERR is for
status, warnings, prompts, and errors.

Use helpers:

```bash
# log - Prints an informational message to stderr.
log() {
  printf '%s\n' "$*" >&2
}

# fail - Prints a fatal error and exits.
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}
```

Rules:

- Use `printf`, not `echo`, for predictable output.
- Error messages go to STDERR.
- Machine-readable output goes to STDOUT and excludes progress text.
- Pipeline scripts include enough context to diagnose the failing step.
- Long-running, cron, publishing, and multi-target scripts use timestamped
  diagnostics with stable fields instead of prose-only progress.
- Include the script name, function or step, host or target, attempt number, and
  status when those fields exist.
- Do not print secrets, tokens, cookies, connection strings, `.env` content, or
  provider payloads.
- Do not use colored output in CI unless the runner and logs support it.
- Do not make parsers depend on human log text.
- Use `logger` or journald only in Linux-only scripts that validate the command
  is available and document the runtime dependency.

Good:

```bash
printf 'Running %s for %s\n' "${step_name}" "${model_variant}" >&2
```

Structured diagnostic:

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

## Literal text and here documents

Rules:

- Use here documents only with commands that read from STDIN.
- Do not use `echo <<EOF`; `echo` does not read the here document body.
- Quote the here-document delimiter when the body must remain literal.
- Use unquoted delimiters only when parameter, command, or arithmetic expansion
  is intended.
- Use `<<-` only when tab-stripping is deliberate. The body must be indented
  with tabs, not spaces.
- Use `printf`, not `echo`, for short literal output.
- Use `$HOME` for home-relative paths in quoted strings. Quoted `~` does not
  expand.
- In interactive shell snippets, quote `!` or disable history expansion with
  `set +H`. Scripts do not use interactive history expansion.

Good:

```bash
cat <<'EOF'
This text is literal.
$HOME is not expanded here.
EOF
```

Good with expansion:

```bash
cat <<EOF
Running ${step_name} for ${model_variant}.
EOF
```

## Comments and documentation

Every Bash file starts with a short file header after the shebang:

```bash
#!/usr/bin/env bash
#
# Run runtime warmup for a configured model.
```

Every function requires a one-line header:

```bash
# normalize_env_name - Converts an environment alias to its canonical name.
normalize_env_name() {
  ...
}
```

For functions that are public, sourced by other files, non-obvious, or risky,
include the full header:

```bash
# push_model - Uploads one model artifact to Hugging Face.
# Globals:
#   HF_TOKEN
# Arguments:
#   Model directory.
#   Hugging Face repository ID.
# Outputs:
#   Writes progress to stderr.
# Returns:
#   0 when upload succeeds, non-zero otherwise.
push_model() {
  ...
}
```

Rules:

- Document behavior, not history.
- Comments explain why a shell pattern is needed when the code is not obvious.
- Do not comment every line.
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an
  expiry date, never a person.
- Suppressions must explain the real constraint and stay as narrow as
  possible.

## Formatting

Rules:

- Indent with 2 spaces. No tabs except tab-stripping here-documents with
  `<<-`.
- Keep Bash source lines within the line length the project sets.
- Use blank lines between logical blocks.
- Keep `; then` and `; do` on the same line as `if`, `for`, `while`, `until`,
  and `select`.
- Put `else`, `elif`, `fi`, `done`, and `esac` on their own aligned lines.
- Prefer one command per line over dense semicolon chains.

Control flow:

```bash
for arg in "$@"; do
  if [[ -n "${arg}" ]]; then
    printf '%s\n' "${arg}"
  else
    printf 'empty argument\n' >&2
  fi
done
```

Case statements:

```bash
case "${environment}" in
  staging)
    run_local_pipeline
    ;;
  production)
    run_publish_pipeline
    ;;
  *)
    printf 'error: unknown environment: %s\n' "${environment}" >&2
    return 1
    ;;
esac
```

Short option parsing may keep simple branches on one line:

```bash
while getopts ':f:v' flag; do
  case "${flag}" in
    f) file="${OPTARG}" ;;
    v) verbose='true' ;;
    *) usage >&2; exit 2 ;;
  esac
done
```

Long pipelines:

```bash
generate_results \
  | jq -r '.items[] | .name' \
  | sort \
  | uniq
```

## Review checklist

Before you run the checks of the repository, read the change against these questions:

- The file has the correct shebang and header.
- The script uses Bash only where Bash is intended.
- Shell options are appropriate and not masking missing checks.
- The script exits with a meaningful final status.
- Every function has the required comment.
- Variables are quoted.
- Argument lists use arrays.
- User input and external data are validated before arithmetic or command use.
- No `eval`, configured `bash -c`, parsed `ls`, or untrusted shell fragments exist.
- Directory changes, deployment, destructive commands, migrations, uploads, and sync commands have explicit failure handling.
- Pipelines behave correctly with or without `pipefail`.
- Redirections are ordered correctly.
- Temporary files are created with `mktemp` and cleaned up.
- Locks are acquired atomically, not with separate check-then-create steps.
- Retries are limited to known retryable failures and have bounded attempts.
- Background jobs are tracked by PID, waited on, and cleaned up on interruption.
- Concurrent jobs keep output separated or use a tool that serializes output.
- Checkpoint files cannot skip required work after inputs or targets change.
- Long-running or multi-target scripts log stable status fields to STDERR.
- Secrets are not printed, traced, or left in files/layers.
- Filenames with spaces and leading dashes are safe.
- Broken symlinks, home-relative paths, and no-match globs have explicit handling.
- `IFS`, `read`, and delimited-data handling do not drop meaningful data.
- Privileged redirection and globbing happen at the intended privilege level.
- Process control does not rely on `ps | grep`.
- Files have UTF-8 without BOM and LF endings.
- macOS/Linux portability is acceptable for the script's runtime.
- The owning shell lint command passes or remaining findings are documented.
- The file is exactly one invocation type: executable entrypoint or sourced library.
- Private functions precede public functions and are not called externally.
- Public library functions and constants use their owner namespace.
- Every repository function dependency is sourced directly.
- No source-only barrel or one-function, one-caller pseudo-module remains.
- Deprecated syntax such as `$[ ... ]`, backticks, `let`, `typeset`, `function`, `&>`, `|&`, and the `[ ... -a ... ]` forms is absent.
- Downloads, generated files, and structured replacements validate temporary data before replacing known-good files.
- Network, remote, mounted-filesystem, and readiness commands have bounded timeouts where they can hang.
