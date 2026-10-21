# Bash

Read this rule when you write or change a shell script.

## Bash scope

<!-- level: all -->

Use Bash to run commands and wire tools together. Parsing, data structures, long-running work, and typed contracts
belong in application code. Treat every path, argument, environment value, command output, and user input as unsafe
until quoted, validated, or parsed by a structured tool. A script that builds, deploys, deletes, or publishes artifacts
makes its inputs, effects, and failure behavior explicit.

`set -euo pipefail` does not replace checks around dangerous commands.

## Deprecated and forbidden syntax

Do not use `function`, `typeset`, `&>`, `|&`, or `for arg; {`. Use `name() { ...; }`,
`local`, `declare`, `readonly`, explicit redirections, and `for arg in "$@"; do` instead.
`trap ERR` does not provide general error handling. Check failure where it matters, and reserve traps
for cleanup that can run safely on the relevant exit path.

## Script structure

<!-- level: all -->

Open an executable script with its shebang and `set -euo pipefail`.
When it defines functions, define `main` and call it last, as `main "$@"`.

## Options

Use `errexit` as a backstop, not as control flow. It does not stop the script inside conditionals, pipelines,
command substitutions, subshells, and some functions. Check the status of `cd`, `rm`, builds, publishing, uploads,
and destructive commands explicitly. Do not toggle
options around a small operation without restoring the prior state. Do not change `IFS` as a
strict-mode ritual; set it locally where reading or joining data requires it. Keep `set -x`
out of committed code.

Put explicit checks inside a function called in `if`, `while`, `&&`, or `||`, because `errexit`
does not stop it there:

```bash
# cleanup: Removes the contents of the target directory.
cleanup() {
    local target="$1"

    cd -- "${target}" || return 1
    find . -mindepth 1 -maxdepth 1 -exec rm -r -- {} +
}
```

Process substitution hides producer failures. When the producer status matters, write to a checked
temporary file, use `PIPESTATUS`, or call it separately. Under `pipefail`, short
readers such as `head` and `grep -q` can make the producer receive SIGPIPE and fail the pipeline.
Consume input predictably or handle the known status. Under `nounset`, use `${name:-}` where
the public interface accepts an unset variable and `${name:?message}` for a required value at a clear
boundary. Use `${1:-}` where callers can omit an argument.

## Output, logging, and errors

Write messages with `printf`, not `echo`. Return or exit with the intended status: printing
an error does not make a command fail.

End an executable script with a meaningful status. A final message, a false condition, or an
optional cleanup check must not set the exit status by accident. Use
an explicit `exit 0` only when the final command's status differs from the program result and
prior checks establish success.

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

A public, sourced, complex, or risky function carries the full header with `Globals`,
`Arguments`, `Outputs`, and `Returns` sections.

## Naming

<!-- level: all -->

### Bash case rules

- Executable scripts use `.sh` when invoked through a task runner or build
  rules.
- Omit the extension on an executable script only when users invoke it
  as a command on `PATH`.
- Give sourced libraries the `.sh` extension and no executable permission.
- Functions and mutable variables use `lower_snake_case`.
- Use `::` in package-like function prefixes only when a script family already
  follows that convention.

| Avoid              | Prefer                     | Meaning              |
| ------------------ | -------------------------- | -------------------- |
| `DeployScript.sh`  | `deploy-api.sh`            | API deployment.      |
| `deploy_script.sh` | `upload-storage-assets.sh` | Storage upload.      |
| `helpers.sh`       | `archive-reports`          | A command on `PATH`. |

Name a deployment function `deploy_api` and its local target
`target_environment`.

### Bash variables

- Name each loop variable after its item.
- Name a temporary path after what it holds, such as `download_file` or `work_dir`; `tmp` and
  `temp` say nothing.
- Avoid vague names when the domain has a term.
- Avoid reserved and special shell names for unrelated values.

Use `migration_file` when iterating migration paths and `report_output` for
captured report text. Check the report command's exit status before printing
the captured output. A loop variable such as `i` does not describe a file.

### Bash functions

- Give a function with side effects a verb-phrase name.
- Name a function that writes to `stdout` for the data it prints.
- Do not name scripts or functions after shell builtins or common commands.
- Do not make function names so generic that logs and stack traces lose context.

Name a port validator `validate_port`. Avoid `test`, which shadows a shell builtin, and
generic names such as `run` or `process`.

### Files

- Put a related script family in its own subfolder, and give its files role names such as
  `main.sh`, `state.sh`, `query.sh`, or `report.sh`.
- Hook families may use a dynamic shared prefix when an external interface owns those
  filenames.
