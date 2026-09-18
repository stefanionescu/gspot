---
layer: language
preset: bash
title: Bash
---

# Bash

The Bash rules span three files. This one covers scope, files, structure, options, output, comments,
and formatting. Language covers functions, variables, quoting, arrays, conditionals, arithmetic,
loops, and paths. Safety covers commands, processes, network, secrets, temporary files, security,
and portability.

## Core Bash philosophy

Rules:

- Bash is glue code. Use it to orchestrate commands, not to build complex
  application logic. `enforced-by: structure/shell-script-policy`
- Prefer small, boring scripts with explicit inputs, explicit outputs, and clear
  failure behavior. `unenforced`
- Treat every path, argument, environment value, command output, and user input
  as unsafe until quoted, validated, or parsed by a structured tool. `enforced-by: bash/shellcheck`
- A script that quantizes models, builds engines, starts runtime services,
  publishes artifacts, deletes artifacts, uploads models, or changes secrets
  must be readable enough to audit line by line. `enforced-by: secrets/gitleaks`
- ShellCheck warnings are design feedback. Fix them unless there is a documented
  reason not to. `enforced-by: bash/shellcheck`
- `set -euo pipefail` is not a substitute for checking dangerous commands. `enforced-by: structure/shell-interpreter`
- Do not hide quantization, engine-build, publishing, runtime, or artifact
  behavior in package scripts or CI YAML. Move non-trivial orchestration into a
  reviewed Bash script. `enforced-by: structure/shell-script-policy`
- When writing shell orchestration, write Bash. Do not create another scripting
  language file as an escape hatch for shell work. `enforced-by: structure/shell-script-policy`
- If scripting logic is too complex for Bash, simplify the workflow or split it into smaller
  scripts. Otherwise move the behavior into product-owned application code as part of a deliberate
  feature change. `unenforced`

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

- calls other command-line tools; `unenforced`
- wires together install, lint, quantization, engine-build, runtime, publish,
  or cleanup steps; `unenforced`
- validates environment and then dispatches to project commands; `unenforced`
- performs simple file movement, process checks, or retry loops. `unenforced`

Do not use Bash for:

- complex business logic; `enforced-by: structure/shell-script-policy`
- complex text parsing; `enforced-by: structure/shell-script-policy`
- JSON, YAML, XML, or HTML transformations beyond simple extraction with a
  dedicated parser; `enforced-by: structure/shell-script-policy`
- large mutable data structures; `enforced-by: structure/shell-script-policy`
- long-lived daemons; `enforced-by: structure/shell-script-policy`
- high-performance work; `enforced-by: structure/shell-script-policy`
- security-sensitive parsing of untrusted input; `unenforced`
- behavior that needs typed contracts. `enforced-by: structure/shell-script-policy`

Do not create non-Bash scripts as an escape hatch. A workflow that needs nested maps, large arrays, `enforced-by: structure/shell-script-policy`
state machines, non-trivial validation, complex retries, concurrent work, or domain rules is too big
for a script. Reduce the scripting scope or implement the behavior in the owning application code.

## File types and invocation

Executable scripts:

- Must start with a Bash shebang. `enforced-by: structure/shell-interpreter`
- Must be executable and directly invoked. `enforced-by: structure/shell-interpreter`
- Must own a `main` function and finish with `main "$@"`, except for
  externally defined hook and task entrypoints whose manager owns the
  invocation contract. `enforced-by: structure/shell-interpreter`
- Must not be sourced by another repository script. `enforced-by: structure/shell-interpreter`

Libraries:

- Keep library files non-executable. `enforced-by: structure/shell-interpreter`
- Must be safe to `source` without running main program behavior. `unenforced`
- Must not contain a `main` function or a `main "$@"` call. `enforced-by: structure/shell-interpreter`
- Must not enable or disable shell options. `enforced-by: structure/shell-interpreter`
- Must not call `exit`. `unenforced`
- Must not perform workflow steps, start processes, mutate runtime state, or
  delete files while loading. `unenforced`
- Configuration libraries may assign documented configuration values while
  loading. Other libraries may only declare readonly owner constants, source
  direct dependencies, and define functions. `enforced-by: structure/shell-interpreter`

Every file declares its runtime contract in the header:

```bash
#!/usr/bin/env bash
#
# Start the configured inference server.
# Runtime: Bash 3.2+, Linux.
```

Use `macOS and Linux` only when the file is supported and reviewed on both `unenforced`
platforms. A newer Bash requirement must name the minimum version and fail
before any other work.

Shebang rules:

```bash
#!/usr/bin/env bash
```

Use this for repo scripts that may run on macOS, Linux, CI, or developer `unenforced`
machines.

```bash
#!/bin/bash
```

Use this only when the target runtime deliberately relies on system Bash at that `unenforced`
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

- Store Bash files as UTF-8 without a byte-order mark. `unenforced`
- Use LF line endings. Do not commit CRLF shell scripts. `enforced-by: structure/shell-interpreter`
- Do not put binary data in shell variables. Bash variables cannot contain NUL. `enforced-by: structure/shell-interpreter`
- Do not use command substitution for content where exact trailing newlines
  matter. `unenforced`
- Keep generated shell snippets free of invisible prefix bytes before the
  shebang. `enforced-by: structure/shell-interpreter`

If a script has Windows line endings, convert it before review:

```bash
tr -d '\r' < "${script}" > "${script}.tmp"
mv -- "${script}.tmp" "${script}"
```

A file that starts with a BOM before `#!` may fail to execute as a script. Treat
that the same as a broken shebang.

## Runtime compatibility

macOS ships Bash 3.2 by default. The header's `Runtime:` line is the contract the gate reads. A file
declaring `Bash 3.2+` may not use Bash 4+ and Bash 5+ features. A file declaring `Bash 4.0+` may use
them, and fails before any other work when the running Bash is older. The gated features are:

- associative arrays; `enforced-by: structure/shell-interpreter`
- `readarray` and `mapfile`; `enforced-by: bash/shellcheck`
- `globstar`; `enforced-by: bash/shellcheck`
- namerefs with `declare -n`; `enforced-by: structure/shell-interpreter`
- `${var@Q}` and other newer parameter transformations; `unenforced`
- `coproc`; `enforced-by: structure/shell-interpreter`
- `BASH_XTRACEFD`; `enforced-by: structure/shell-interpreter`
- `wait -n`; `enforced-by: structure/shell-interpreter`
- `local -n`; `unenforced`
- `shopt -s lastpipe`; `unenforced`
- process-substitution behavior that has not been verified on the target OS. `unenforced`

If a script requires a newer Bash:

```bash
require_bash_4() {
  if (( BASH_VERSINFO[0] < 4 )); then
    printf 'error: bash 4 or newer is required\n' >&2
    return 1
  fi
}
```

State the requirement in the file header and fail before doing work. `enforced-by: structure/shell-interpreter`

## Deprecated and forbidden syntax

Use the modern, explicit Bash form even when an older spelling still works. `unenforced`

Forbidden forms:

- Arithmetic expansion: do not use `$[ ... ]`. Use `$(( ... ))`. `enforced-by: bash/shellcheck`
- Command substitution: do not use backtick substitution. Use `$(...)`. `enforced-by: bash/shellcheck`
- Arithmetic command: do not use `let`. Use `(( ... ))` or assignment with
  `$(( ... ))`. `enforced-by: bash/shellcheck`
- Declarations: do not use `typeset`. Use `local`, `declare`, `readonly`, or
  `export` according to the value's real scope. `enforced-by: bash/shellcheck`
- Function definitions: do not use the `function` keyword, including
  `function name()`, `function name() { ... }`, or `function name { ... }`.
  Use `name() { ...; }`. `enforced-by: bash/shellcheck`
- Compact loop syntax: do not use `for arg; { ...; }`. Use
  `for arg in "$@"; do ... done`. `unenforced`
- Combined redirection shortcuts: do not use `&>file` or `>&file`. Use
  `>file 2>&1`. `enforced-by: bash/shellcheck`
- Combined pipeline shorthand: do not use `cmd |& other`. Use
  `cmd 2>&1 | other`. `unenforced`
- Test composition: do not use `test -a`, `test -o`, `[ ... -a ... ]`,
  `[ ... -o ... ]`, or grouping operators inside `[ ... ]`. Use `[[ ... ]]`,
  explicit `if` branches, or `case`. `enforced-by: bash/shellcheck`
- `ERR` traps: do not use `trap ERR` as general error handling. Use explicit
  status checks where failure matters, and reserve traps for cleanup that is
  safe to run on the relevant exit path. `enforced-by: bash/shellcheck`
- `eval`: do not use casual `eval` to turn strings into code. Use arrays,
  direct validation, `case`, or fixed dispatch tables. `enforced-by: bash/shellcheck`

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

1. Shebang. `enforced-by: structure/shell-interpreter`
2. File header comment. `enforced-by: structure/shell-interpreter`
3. Shell options. `enforced-by: structure/shell-interpreter`
4. `source` statements. `enforced-by: structure/shell-interpreter`
5. Constants and exported configuration. `enforced-by: structure/shell-interpreter`
6. Functions: private functions (prefixed `_`, called from no other file) first, then the
   functions other files source, then `main`. `enforced-by: structure/private-prefix`
7. `main`. `unenforced`
8. `main "$@"` as the last non-comment line for executable scripts. `enforced-by: structure/shell-interpreter`

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
  `main` is exempt. `enforced-by: structure/shell-interpreter`
- Do not put executable program flow between function definitions. `enforced-by: structure/shell-interpreter`
- Do not mutate global state while loading a library unless that mutation is the
  documented purpose of the library. `enforced-by: bash/shellcheck`
- Source files with explicit paths based on `BASH_SOURCE[0]`, not the caller's
  current directory. `unenforced`
- Libraries may define constants, functions, and validation helpers. Entrypoints
  own argument parsing and `main`. `enforced-by: structure/shell-interpreter`
- Executable scripts must finish with a meaningful program status. Do not let a
  final diagnostic command, false condition, or optional cleanup check become
  the script status by accident. `enforced-by: structure/shell-interpreter`
- Use explicit `exit 0` only when the final command's status is not the program
  result and success has already been established. `enforced-by: structure/shell-interpreter`

## Shell options

Use shell options deliberately. `enforced-by: structure/shell-interpreter`

Common entrypoint default:

```bash
set -euo pipefail
```

Rules:

- Use `set -euo pipefail` only when the script is written and reviewed for those
  semantics. `enforced-by: structure/shell-interpreter`
- Do not rely on `errexit` for critical safety. Explicitly check `cd`, `rm`,
  quantization, engine-build, runtime, publishing, upload, and destructive
  commands. `enforced-by: bash/shellcheck`
- Treat `errexit` as a backstop, not control flow. It has exceptions in
  conditionals, pipelines, command substitutions, subshells, and functions. `enforced-by: structure/shell-interpreter`
- Do not enable shell options in sourced libraries unless the library is part of
  a script family that already owns those options. `enforced-by: structure/shell-interpreter`
- Do not toggle options globally around a small operation without restoring the
  prior state. `enforced-by: bash/shellcheck`
- Sourced libraries must not call `set` at all. Capture command status with
  `if`, `if !`, or an explicit conditional command instead. `enforced-by: structure/shell-interpreter`
- Do not change `IFS` as part of a fake strict-mode ritual. Set `IFS` locally
  only where reading or joining data requires it. `enforced-by: bash/shellcheck`
- Avoid `set -x` in committed code. If temporary tracing is necessary, keep it
  local and make sure secrets cannot be printed. `enforced-by: structure/shell-interpreter`

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

Prefer a command that consumes input predictably, or handle the known status `enforced-by: bash/shellcheck`
explicitly. Short readers such as `head`, `grep -q`, and commands that stop
after the first match can create false failures under `pipefail`.

`nounset` rules:

- Do not enable `set -u` blindly in an existing script. The script must be
  reviewed for unset positional parameters, optional environment variables, and
  arrays. `enforced-by: structure/shell-interpreter`
- Use `${name:-}` when an unset variable is acceptable. `enforced-by: structure/shell-config-defaults`
- Use `${name:?message}` for required configuration at a clear boundary. `enforced-by: structure/shell-config-defaults`
- Do not use unguarded `${1}` when an argument may be missing. Use `${1:-}`. `enforced-by: structure/shell-config-defaults`
- Be careful with arrays under `set -u`; check lengths before indexing. `enforced-by: structure/shell-interpreter`
- If empty arrays are meaningful, require Bash 4.4+ before relying on
  their behavior under `set -u`. Bash 3.2-compatible scripts must guard array
  access explicitly. `enforced-by: structure/shell-interpreter`

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

- Use `printf`, not `echo`, for predictable output. `enforced-by: bash/shellcheck`
- Error messages go to STDERR. `enforced-by: structure/shell-safety`
- Machine-readable output goes to STDOUT and excludes progress text. `enforced-by: structure/shell-safety`
- Pipeline scripts include enough context to diagnose the failing step. `enforced-by: structure/shell-safety`
- Long-running, cron, publishing, and multi-target scripts use timestamped
  diagnostics with stable fields instead of prose-only progress. `enforced-by: structure/shell-safety`
- Include the script name, function or step, host or target, attempt number, and
  status when those fields exist. `enforced-by: bash/shellcheck`
- Do not print secrets, tokens, cookies, connection strings, `.env` content, or
  provider payloads. `enforced-by: structure/shell-safety`
- Do not use colored output in CI unless the runner and logs support it. `enforced-by: structure/shell-safety`
- Do not make parsers depend on human log text. `unenforced`
- Use `logger` or journald only in Linux-only scripts that validate the command
  is available and document the runtime dependency. `enforced-by: structure/shell-safety`

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

- Use here documents only with commands that read from STDIN. `enforced-by: bash/shellcheck`
- Do not use `echo <<EOF`; `echo` does not read the here document body. `enforced-by: bash/shellcheck`
- Quote the here-document delimiter when the body must remain literal. `enforced-by: bash/shellcheck`
- Use unquoted delimiters only when parameter, command, or arithmetic expansion
  is intended. `enforced-by: bash/shellcheck`
- Use `<<-` only when tab-stripping is deliberate. The body must be indented
  with tabs, not spaces. `enforced-by: bash/shellcheck`
- Use `printf`, not `echo`, for short literal output. `enforced-by: bash/shellcheck`
- Use `$HOME` for home-relative paths in quoted strings. Quoted `~` does not
  expand. `enforced-by: bash/shellcheck`
- In interactive shell snippets, quote `!` or disable history expansion with
  `set +H`. Scripts do not use interactive history expansion. `enforced-by: bash/shellcheck`

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

- Document behavior, not history. `enforced-by: structure/doc-comment`
- Comments explain why a shell pattern is needed when the code is not obvious. `unenforced`
- Do not comment every line. `enforced-by: structure/doc-comment`
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an
  expiry date, never a person. `enforced-by: structure/doc-comment`
- Suppressions must explain the real constraint and stay as narrow as
  possible. `enforced-by: integrity/suppressions`

## Formatting

Rules:

- Indent with 2 spaces. No tabs except tab-stripping here-documents with
  `<<-`. `enforced-by: bash/shellcheck`
- Keep Bash source lines within the line length the project sets. `enforced-by: bash/shfmt`
- Use blank lines between logical blocks. `enforced-by: bash/shfmt`
- Keep `; then` and `; do` on the same line as `if`, `for`, `while`, `until`,
  and `select`. `enforced-by: bash/shfmt`
- Put `else`, `elif`, `fi`, `done`, and `esac` on their own aligned lines. `enforced-by: bash/shfmt`
- Prefer one command per line over dense semicolon chains. `enforced-by: bash/shfmt`

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

Before `gspot check`, read the change against these questions:

- The file has the correct shebang and header. `enforced-by: structure/shell-interpreter`
- The script uses Bash only where Bash is intended. `unenforced`
- Shell options are appropriate and not masking missing checks. `enforced-by: structure/shell-interpreter`
- The script exits with a meaningful final status. `enforced-by: bash/shellcheck`
- Every function has the required comment. `unenforced`
- Deprecated syntax such as `$[ ... ]`, backticks, `let`, `typeset`, `function`, `enforced-by: bash/shellcheck`
- Variables are quoted. `enforced-by: bash/shellcheck`
- Argument lists use arrays. `unenforced`
- User input and external data are validated before arithmetic or command use. `unenforced`
- No `eval`, configured `bash -c`, parsed `ls`, or untrusted shell fragments exist. `enforced-by: bash/shellcheck`
- `cd`, deployment, destructive, migration, upload, and sync commands are `enforced-by: bash/shellcheck`
- Pipelines behave correctly with or without `pipefail`. `enforced-by: structure/shell-interpreter`
- Redirections are ordered correctly. `enforced-by: bash/shellcheck`
- Temporary files are created with `mktemp` and cleaned up. `enforced-by: bash/shellcheck`
- Downloads, generated files, and structured replacements validate temporary `unenforced`
- Locks are acquired atomically, not with separate check-then-create steps. `unenforced`
- Network, remote, mounted-filesystem, and readiness commands have bounded `enforced-by: structure/shell-ssh-blocks`
- Retries are limited to known retryable failures and have bounded attempts. `unenforced`
- Background jobs are tracked by PID, waited on, and cleaned up on interruption. `enforced-by: structure/shell-safety`
- Concurrent jobs keep output separated or use a tool that serializes output. `unenforced`
- Checkpoint files cannot skip required work after inputs, targets, or runs `unenforced`
- Long-running or multi-target scripts log stable status fields to STDERR `enforced-by: structure/shell-safety`
- Secrets are not printed, traced, or left in files/layers. `enforced-by: secrets/gitleaks`
- Filenames with spaces and leading dashes are safe. `unenforced`
- Broken symlinks, home-relative paths, and no-match globs are handled `enforced-by: bash/shellcheck`
- `IFS`, `read`, and delimited-data handling do not drop meaningful data. `enforced-by: bash/shellcheck`
- Privileged redirection and globbing happen at the intended privilege level. `enforced-by: bash/shellcheck`
- Process control does not rely on `ps | grep`. `unenforced`
- Files have UTF-8 without BOM and LF endings. `enforced-by: structure/shell-interpreter`
- macOS/Linux portability is acceptable for the script's runtime. `enforced-by: structure/shell-interpreter`
- The owning shell lint command passes or remaining findings are documented. `unenforced`
- The file is exactly one invocation type: executable entrypoint or `enforced-by: structure/shell-interpreter`
- Private functions precede public functions and are not called externally. `enforced-by: structure/private-prefix`
- Public library functions and constants use their owner namespace. `enforced-by: structure/shell-interpreter`
- Every repository function dependency is sourced directly. `enforced-by: structure/shell-interpreter`
- No source-only barrel or one-function, one-caller pseudo-module remains. `unenforced`
- `cd`, quantization, engine-build, runtime, publishing, upload, and `enforced-by: bash/shellcheck`
- Deprecated syntax such as `$[ ... ]`, backticks, `let`, `typeset`, `function`, `&>`, `|&`, and the `[ ... -a ... ]` forms is absent. `enforced-by: bash/shellcheck`
- Downloads, generated files, and structured replacements validate temporary data before replacing known-good files. `unenforced`
- Network, remote, mounted-filesystem, and readiness commands have bounded timeouts where they can hang. `enforced-by: structure/shell-ssh-blocks`
