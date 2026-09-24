---
layer: language
configuration: bash
title: Bash Safety
---

# Bash Safety

Calling commands, processes and privilege, structured data, network, secrets, temporary files,
security, portability, testing, debugging, and refactoring.

## Calling commands

Rules:

- Check command availability before using non-standard tools.
- Check uncommon commands before long-running, destructive, publishing, or
  error-handling paths depend on them.
- Use fixed command names and argument arrays.
- Do not build shell commands as strings.
- Do not pass untrusted input to a shell.
- Use `command -v` for command discovery.
- `hash` is acceptable for simple PATH availability checks when no path output
  is needed.
- Use `builtin` or Bash parameter expansion instead of external commands for
  simple string and arithmetic work.
- Use `grep -q` only when early pipe closure will not cause false failures under
  `pipefail`.
- Use `--` before user-controlled positional arguments when supported.
- Pass a file directly to a command instead of using `cat file | command` unless
  concatenation or a pipeline-only interface is required.
- Do not run `su -c 'command'` without the target username. Prefer `sudo` or the
  platform's service owner tools.
- For multiple date fields, get one timestamp, and derive fields from it.
- Application code that invokes commands must pass an argument array to the
  process API, not a shell string.
- When shell features are genuinely required, use a static Bash snippet and pass
  dynamic values as positional arguments.
- Treat remote `ssh` command strings as a last resort. Prefer a reviewed script
  copied to the host or pass fixed commands plus deliberately quoted arguments.
- `bash -lc` is forbidden in repository scripts.
- Do not accept a command string parameter. Accept the command and its
  arguments after `shift`, then invoke `"$@"`.

Command requirement helper:

```bash
# require_command - Ensures a command exists on PATH.
# Arguments:
#   Command name.
require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'error: required command not found: %s\n' "${command_name}" >&2
    return 1
  fi
}
```

Good:

```bash
declare -a cmd
cmd=(python -m hf.push --model-dir "${model_dir}" --repo-id "${repo_id}")
"${cmd[@]}"
```

Shell boundary:

```bash
bash -c 'printf "%s\n" "$1"' bash "${message}"
```

## Process management and privilege boundaries

Rules:

- Do not use `ps ... | grep name` as process control.
- Prefer service-manager commands, PID files owned by the script family,
  `pgrep`/`pkill` with exact matching, or platform-native process APIs.
- Ordinary stop and restart paths stop only PIDs recorded by the owning script
  family.
- Treat process names as advisory. They are not an authorization boundary.
- When starting background jobs, save each PID, `wait` for each PID, and capture
  each job's status explicitly.
- Scripts that start background work must clean up owned child processes on
  `INT`, `TERM`, and `EXIT`.
- Keep per-job output in separate files when concurrent jobs can interleave
  logs.
- Avoid unbounded fan-out. When targeting many hosts or files, use an explicit
  concurrency limit or a purpose-built tool such as Ansible or GNU Parallel.
- `sudo command > file` redirects as the current user, not as root.
- Globs in `sudo command /path/*` expand before `sudo` runs.
- Use `sudo tee` for privileged file writes.
- Use a fixed `sudo sh -c '...'` wrapper only when root-owned shell expansion or
  redirection is genuinely required.
- Do not put user input inside privileged shell strings.

Privileged write:

```bash
generate_config | sudo tee /etc/service/config >/dev/null
```

Privileged glob, fixed string only:

```bash
sudo sh -c 'ls /root-owned-dir/*.conf'
```

Process lookup:

```bash
pgrep -x service_name >/dev/null
```

Small bounded background jobs:

```bash
declare -a child_pids

# cleanup_children - Stops child processes started by this script.
cleanup_children() {
  local pid

  for pid in "${child_pids[@]}"; do
    kill -0 "${pid}" >/dev/null 2>&1 || continue
    kill "${pid}" >/dev/null 2>&1 || true
  done
}

# run_remote_checks - Runs remote checks and returns non-zero on any failure.
# Arguments:
#   Small, already bounded host list to check.
run_remote_checks() {
  local host
  local pid
  local status=0

  trap 'cleanup_children' EXIT
  trap 'cleanup_children; exit 130' INT
  trap 'cleanup_children; exit 143' TERM

  for host in "$@"; do
    check_host "${host}" >"${tmp_dir}/${host}.log" 2>&1 &
    pid=$!
    child_pids+=( "${pid}" )
  done

  for pid in "${child_pids[@]}"; do
    if ! wait "${pid}"; then
      status=1
    fi
  done

  trap - EXIT INT TERM
  return "${status}"
}
```

Bad:

```bash
ps ax | grep service_name
sudo mycmd > /etc/service/config
sudo ls /root-owned-dir/*
sudo sh -c "systemctl restart ${unit_name}"
```

## Text, JSON, and structured data

Rules:

- Use Bash parameter expansion for simple string edits.
- Use `jq` for JSON.
- Use `yq` or a project-owned parser for YAML when YAML structure matters.
- Do not parse JSON, YAML, XML, HTML, plist, or xcodebuild output with ad hoc
  `grep | sed | awk` unless the input is controlled and the format is trivial.
- Prefer command output modes intended for machines, such as JSON, NUL, or
  explicit format flags.
- Avoid parsing human-oriented command output such as `ls`, pretty tables,
  progress bars, or localized text.
- Quote `tr` character classes and account for locale when converting case.
- Use double quotes only when shell expansion is intended in `sed` expressions,
  and escape replacement values correctly.
- Do not parse process lists, table columns, or localized command output with
  fixed field numbers unless the producer has a machine-readable contract.

Good JSON:

```bash
service_url="$(jq -r '.service.url // empty' "${config_file}")" || return 1
[[ -n "${service_url}" ]] || {
  printf 'error: service.url is required\n' >&2
  return 1
}
```

Use `awk`, `sed`, and `perl` when they are the right text-processing tool, but
keep shell quoting clear and avoid in-place editing portability traps.

macOS and GNU `sed -i` differ. Prefer temp files for committed scripts unless a
script is platform-specific and documented.

Case conversion:

```bash
tr '[:upper:]' '[:lower:]'
LC_COLLATE=C tr A-Z a-z
```

## Network commands

Rules:

- Use `curl --fail --show-error --silent --location` for downloads unless the
  endpoint requires different behavior.
- Use bounded timeouts for commands that can hang, including `ssh`, `scp`,
  `curl`, `find` over mounted filesystems, and remote service checks.
- Prefer tool-native timeout options first, such as SSH `ConnectTimeout` and
  curl `--connect-timeout` plus `--max-time`.
- Wrap with `timeout` only when GNU/coreutils availability has been validated
  for the script's runtime. macOS does not provide GNU `timeout` by default.
- Write downloads to explicit files.
- Verify checksums or signatures for executable downloads.
- Do not pipe network content into `bash` unless the source is pinned, trusted,
  and there is no safer package manager or checksum-based flow.
- Do not print response bodies that may contain secrets.
- Use retries only for known retryable network, provider, or service failures,
  with bounded attempts, delay, and attempt-count logging.
- Do not retry corrupt data, syntax errors, invalid credentials, missing
  required files, failed validation, or permission problems.
- Separate download, verification, and execution into visible steps.

Good:

```bash
download_file() {
  local url="$1"
  local output_file="$2"

  curl --fail --show-error --silent --location \
    --connect-timeout 10 \
    --max-time 60 \
    --output "${output_file}" \
    "${url}"
}
```

Remote timeout:

```bash
ssh \
  -o ConnectTimeout=10 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=2 \
  -- "${host}" \
  systemctl is-active --quiet "${service_name}"
```

Installer pattern:

```bash
tmp_dir="$(mktemp -d)" || return 1
trap 'rm -rf "${tmp_dir}"' RETURN

installer="${tmp_dir}/install.sh"
curl --fail --show-error --silent --location \
  --connect-timeout 10 \
  --max-time 60 \
  --output "${installer}" \
  "${installer_url}" || return 1

printf '%s  %s\n' "${expected_sha256}" "${installer}" | shasum -a 256 -c - || return 1
bash "${installer}" --version "${tool_version}"
```

## Secrets and environment

Rules:

- Read configuration and secrets from the caller environment in one place: the top of the
  entrypoint or the configuration library. Workflow functions receive values as arguments.
- Read secrets from the caller environment, a secret manager, or documented
  ignored env files.
- Validate required secrets at the boundary.
- Do not echo, trace, write, commit, or include secrets in command-line
  arguments when the process table can expose them.
- Prefer files or stdin for tools that accept sensitive values that way.
- Do not use `set -x` around secret handling.
- Do not write `.env` files from scripts unless the script owns that lifecycle
  and the path is ignored.
- Do not include secret values in failure messages.
- Redact secrets before logging external command output.

Required env helper:

```bash
# require_env - Ensures an environment variable is set and non-empty.
# Arguments:
#   Environment variable name.
require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    printf 'error: %s is required\n' "${name}" >&2
    return 1
  fi
}
```

Do not pass untrusted env names to `${!name}` without validation:

```bash
if [[ ! "${name}" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
  printf 'error: invalid env var name\n' >&2
  return 1
fi
```

## Temporary files, locks, and cleanup

Rules:

- Use `mktemp` or `mktemp -d`.
- Put temporary files under the system temp directory or an explicit project
  temp directory.
- Quote temp paths.
- Register cleanup immediately after creation.
- Use `trap` carefully and restore traps when needed.
- Do not use predictable names in `/tmp`.
- Download, copy, or generate into a temporary file first, validate it, then
  replace the destination with `mv`.
- Validate structured data with the real parser before replacing known-good
  data, such as `jq` for JSON.
- Remove failed or corrupt temporary artifacts unless the script explicitly
  documents that they are kept for inspection.
- Acquire locks atomically with `mkdir` lock directories or `noclobber`
  redirection. Do not check with `test` and then create the lock later.
- For lock directories, write the owner PID, and recover stale locks explicitly.
- Do not delete broad globs under variable paths without validation.
- Full cleanup is opt-in. Stop commands preserve environments, caches, models,
  and unrelated runtime resources by default.
- Cleanup must be limited to repository-owned paths and PIDs. Do not delete
  whole home cache roots, arbitrary dynamic cache roots, or shared `/tmp`
  families.
- Before `rm -rf`, canonicalize or structurally validate the target against an
  explicit owner root. Reject empty paths, `/`, the repository root itself,
  `$HOME`, and any path outside the declared owner.
- Do not use `|| true` on destructive commands or required installation,
  publishing, quantization, engine-build, or runtime commands.

Good:

```bash
tmp_dir="$(mktemp -d)" || return 1
trap 'rm -rf "${tmp_dir}"' EXIT
```

Atomic structured replacement:

```bash
tmp_file="$(mktemp "${config_file}.XXXXXX")" || return 1
trap 'rm -f "${tmp_file}"' RETURN

curl --fail --show-error --silent --location \
  --connect-timeout 10 \
  --max-time 60 \
  --output "${tmp_file}" \
  "${config_url}" || return 1

jq empty "${tmp_file}" >/dev/null || return 1
mv -- "${tmp_file}" "${config_file}" || return 1
trap - RETURN
```

Race-safe lock directory:

```bash
lock_dir="${state_dir}/publish.lock"

if ! mkdir "${lock_dir}"; then
  printf 'error: lock is already held: %s\n' "${lock_dir}" >&2
  return 1
fi

printf '%s\n' "$$" >"${lock_dir}/pid" || {
  rmdir "${lock_dir}"
  return 1
}

trap 'rm -rf "${lock_dir}"' EXIT
```

Function-scoped cleanup:

```bash
run_with_temp_dir() {
  local tmp_dir
  tmp_dir="$(mktemp -d)" || return 1
  trap 'rm -rf "${tmp_dir}"' RETURN

  generate_files "${tmp_dir}"
}
```

Destructive operations must validate the target:

```bash
remove_build_dir() {
  local build_dir="$1"

  [[ -n "${build_dir}" ]] || return 1
  [[ "${build_dir}" == */build ]] || return 1
  rm -rf -- "${build_dir}"
}
```

## Security rules

Never:

- use `eval` with dynamic input;
- use `ERR` traps as a substitute for explicit status checks;
- build shell commands from user input;
- pass user input to `bash -c`;
- parse untrusted arithmetic expressions with `(( ... ))`;
- use unsanitized values as variable names, associative array keys in arithmetic
  contexts, model variants, repository names, remote paths, or remote shell
  fragments;
- use unquoted variables in paths or arguments;
- run destructive commands against unchecked variables;
- parse `ls`;
- use `find -exec sh -c '...'` with `{}` embedded in the script string;
- use `xargs` without `-0` for filenames;
- pipe unverified network data to an interpreter;
- log secrets;
- keep debug tracing enabled around credentials.

Safe `find -exec sh -c`:

```bash
find . -type f -name '*.sql' -exec sh -c 'lint_sql "$1"' sh {} \;
```

Safe xargs:

```bash
find . -type f -name '*.sh' -print0 | xargs -0 shellcheck --
```

If a value must become a command argument, keep it as an argument. Do not turn it
into code.

## Portability rules

Rules:

- Default to Bash 3.2-compatible syntax unless runtime support is checked.
- Every file header declares the supported platform and minimum Bash version.
- The declared contract and syntax must agree. Bash 4+ features such as
  `mapfile`, `readarray`, associative arrays, and `${value,,}` require a
  checked Bash 4+ entry boundary; otherwise they are forbidden.
- Account for macOS/BSD and GNU differences in `sed`, `date`, `readlink`,
  `mktemp`, `stat`, `xargs`, and `grep`.
- Prefer project-provided wrappers for platform-specific behavior.
- Do not use `realpath` unless the target platform guarantees it.
- Use `pwd -P` after `cd` for physical paths when symlinks matter.
- Avoid `sed -i` unless platform-specific behavior is handled.
- Avoid `date` parsing that differs between GNU and BSD.
- Do not assume `/bin/bash` is a modern Bash on macOS.
- Do not use Linux-only utilities in macOS-compatible scripts without checks.
- Do not assume CI has the same PATH as a developer shell.

Portable-ish script directory:

```bash
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
```

When absolute path resolution must handle symlinks across platforms, prefer a
small verified Bash helper or product-owned application code.

## No Bash tests

Rules:

- Do not create Bash test suites.
- Do not add Bats, shunit2, ShellSpec, custom Bash harnesses, PATH mock wrappers,
  or sample directories for Bash scripts.
- Do not add test-only branches, test-only flags, or test-only dependency
  injection to Bash scripts.
- Do not create sample files only to exercise Bash behavior.
- Do not move Bash orchestration into another scripting language only to make it
  easier to test.
- Bash verification is static review, ShellCheck, shfmt, and `bash -n`.
- Runtime trial runs are allowed only when they are part of the requested
  workflow or needed to verify a real publish/local command, not as a new test
  suite.

## Debugging Bash

Rules:

- Start with the exact error message and the line it names. Do not guess before
  checking the command Bash actually reports.
- Use `bash -n` and ShellCheck before tracing.
- Reduce the failing script to the smallest command block that reproduces the
  problem.
- Use `printf '%q\n'` to expose whitespace, CRLF, quoting, and invisible
  characters in suspicious values.
- Use `bash -x script.sh`, a local `set -x` block, or `set -v` only while
  diagnosing. `set -v` prints input as Bash reads it and can expose surprising
  line continuations.
- Set `PS4` to include file, line, and function context when tracing complex
  scripts.
- Never trace secret handling.
- Do not commit broad `set -x`, `trap DEBUG`, or interactive stepping code.
- `BASH_XTRACEFD` requires newer Bash than the project default. Gate it with a
  version check before use.
- Debug helpers must preserve or explicitly return the script status they are
  diagnosing. A helper that prints diagnostics must not accidentally turn a
  failure into success.

Tracing pattern:

```bash
PS4='+${BASH_SOURCE}:${LINENO}:${FUNCNAME[0]:-main}: '
set -x
run_non_secret_step
set +x
```

Verbose input tracing:

```bash
set -v
source "${config_file}"
set +v
```

Expose invisible characters:

```bash
printf '%q\n' "${path}"
```

Gate newer trace-file support:

```bash
if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 1) )); then
  exec 9>"${trace_file}"
  BASH_XTRACEFD=9
fi
```

Syntax and lint checks:

```bash
bash -n path/to/script.sh
shellcheck path/to/script.sh
```

Common failure causes:

- `unexpected EOF`: unmatched quotes, unterminated here documents, missing
  `fi`, `done`, `esac`, or a CRLF line ending hiding the delimiter.
- `too many arguments`: unquoted expansion inside `[ ... ]`, or data that
  belongs in `[[ ... ]]`.
- `event not found`: interactive history expansion from `!`; quote the value or
  disable history expansion in the interactive snippet.
- Command runs differently than expected: alias, function, shell builtin, or
  PATH collision. Check with `type -a command_name`.
- Script fails before the shebang: UTF-8 BOM or CRLF line endings.

## Refactoring existing scripts

When fixing or refactoring Bash:

1. Read the whole script and sourced libraries first.
2. Identify the caller contract: local dev, CI, remote host, or package script.
3. Preserve behavior before changing style.
4. Fix quoting and argument arrays near the touched logic.
5. Add explicit checks around dangerous commands.
6. Move duplicated shell helpers into the local script family only when the
   helper has a real shared contract.
7. Do not convert a large script in one pass unless the task is explicitly a
   script cleanup.
8. Do not change shebangs across a script family unless runtime compatibility is
   verified.
9. Run the narrow shell lint/format command first, then broader checks when the
   owning rule file requires them.

When a script is too complex:

- keep the Bash wrapper thin;
- move parsing or business logic into product-owned application code;
- keep command invocation and environment validation in Bash only if that is the
  simplest operational boundary.
