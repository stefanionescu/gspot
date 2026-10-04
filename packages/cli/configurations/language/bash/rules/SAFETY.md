---
title: Bash Safety
---

# Bash Safety

Calling commands, processes and privilege, structured data, network, secrets, temporary files,
portability, and debugging.

## Calling commands

Commands are fixed names with argument arrays, never strings built from input, and a script
never passes untrusted input to a shell. `bash -lc` is forbidden in repository scripts, and a
function that runs a caller-supplied command takes the command and its arguments after
`shift` and invokes `"$@"`.

Check uncommon commands with `command -v` before a long-running, destructive, publishing, or
error-handling path depends on them. Prefer builtins and parameter expansion to external
commands for simple string and arithmetic work, and pass files directly rather than through
`cat`. Never run `su -c` without the target user.

```bash
# require_command: Ensures a command exists on PATH.
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

## Processes and privilege

Process names are advisory, never an authorization boundary. Stop and restart paths stop only
PIDs recorded by the owning script family, found through the service manager, a PID file, or
`pgrep -x`, never `ps | grep`. A script that starts background jobs saves each PID, waits for
each, captures each status, and writes per-job output to separate files. It bounds its
fan-out and kills owned children on `INT`, `TERM`, and `EXIT`. `sudo command > file` redirects
as the current user, and a glob in `sudo command /path/*` expands before `sudo` runs.
Privileged writes go through `sudo tee`, and a privileged shell string is a fixed literal
with no input.

```bash
generate_config | sudo tee /etc/service/config >/dev/null

# run_remote_checks: Runs remote checks and returns non-zero on any failure.
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
    check_host "${host}" >"${work_dir}/${host}.log" 2>&1 &
    child_pids+=( "$!" )
  done

  for pid in "${child_pids[@]}"; do
    wait "${pid}" || status=1
  done

  trap - EXIT INT TERM
  return "${status}"
}
```

## Structured data

Simple string edits use parameter expansion. JSON goes through `jq`, and YAML through `yq` or
a project-owned parser. JSON, YAML, XML, HTML, plist, and xcodebuild output are never parsed
with ad hoc `grep | sed | awk` unless the input is controlled and the format trivial.
Prefer machine output modes (JSON, NUL, explicit format flags) and never parse process lists,
pretty tables, progress bars, or localized text by fixed field numbers. Quote `tr` character
classes and pin `LC_ALL=C` when converting case. macOS and GNU `sed -i` differ; a committed
script rewrites through a temporary file unless it is documented as platform-specific.

```bash
# get_service_url: Prints a required nonempty service URL from JSON configuration.
get_service_url() {
  local config_file="${1:?Configuration file is required}"
  local service_url

  service_url="$(jq -er '.service.url | select(type == "string" and length > 0)' "${config_file}")" || return 1
  printf '%s\n' "${service_url}"
}
```

## Network

Downloads use `curl --fail --show-error --silent --location` into an explicit file, with
tool-native timeouts (`--connect-timeout` plus `--max-time`, SSH `ConnectTimeout`) rather
than GNU `timeout`, which macOS lacks. Executable content is downloaded, verified against an
independently obtained checksum or signature, and only then run.

```bash
installer="${work_dir}/install.sh"
curl --fail --show-error --silent --location \
  --connect-timeout 10 \
  --max-time 60 \
  --output "${installer}" \
  "${installer_url}" || exit 1
printf '%s  %s\n' "${expected_sha256}" "${installer}" | shasum -a 256 -c - || exit 1
bash "${installer}" --version "${tool_version}"

ssh -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 \
  -- "${host}" systemctl is-active --quiet "${service_name}"
```

## Secrets and environment

Keep `set -x` away from secrets. An indirect expansion `${!name}` takes only a validated name.

```bash
# require_env: Ensures an environment variable is set and non-empty.
# Arguments:
#   Environment variable name.
require_env() {
  local name="$1"

  if [[ ! "${name}" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    printf 'error: invalid env var name\n' >&2
    return 1
  fi
  if [[ -z "${!name:-}" ]]; then
    printf 'error: %s is required\n' "${name}" >&2
    return 1
  fi
}
```

## Temporary files, locks, and cleanup

Temporary paths come from `mktemp` or `mktemp -d` under the system or an explicit project
temp directory, never from predictable names, and cleanup is registered right after creation.
Downloaded, copied, or generated content lands in a temporary file, is validated by the real
parser, and replaces the destination with `mv`. The file keeps the restrictive permissions
`mktemp` gave it unless deployment needs others. Failed artifacts are removed unless the script
documents keeping them. Locks are acquired atomically with a `mkdir` lock directory holding
the owner PID or with `noclobber` redirection, never with a `test` followed by a create.

Stop commands remove only what the script created. A cleanup path from
input or persistent state is validated against its owner root. It rejects empty values, `/`,
the repository root, `$HOME`, symlinks, and anything outside the owner. A `mktemp -d` result
is kept exactly and never widened to its neighbors. `|| true` never follows a destructive
command or a required installation, publishing, build, or runtime command.

```bash
downloaded_file="$(mktemp "${config_file}.XXXXXX")" || exit 1
trap 'rm -f -- "${downloaded_file}"' EXIT
curl --fail --show-error --silent --location --output "${downloaded_file}" "${config_url}" || exit 1
jq empty "${downloaded_file}" >/dev/null || exit 1
mv -- "${downloaded_file}" "${config_file}" || exit 1
trap - EXIT

if ! mkdir "${lock_dir}"; then
  printf 'error: lock is already held: %s\n' "${lock_dir}" >&2
  return 1
fi
printf '%s\n' "$$" >"${lock_dir}/pid" || {
  rmdir "${lock_dir}"
  return 1
}
trap 'rm -f -- "${lock_dir}/pid"; rmdir -- "${lock_dir}"' EXIT
```

Put recursive deletes in a script listed in `bash.safety_owners`. Validate its cleanup path
against the owner root:

```bash
# remove_build_dir: Removes the build child of the approved owner directory.
remove_build_dir() {
  local owner_root build_dir

  [[ -n "$1" ]] || return 1
  owner_root="$(cd -- "$1" && pwd -P)" || return 1
  [[ "${owner_root}" != / ]] || return 1
  build_dir="${owner_root}/build"
  [[ -d "${build_dir}" && ! -L "${build_dir}" ]] || return 1
  rm -rf -- "${build_dir}"
}
```

## Portability

macOS and BSD
differ from GNU in `sed`, `date`, `readlink`, `mktemp`, `stat`, `xargs`, and `grep`; keep a
platform-specific branch with the operation that owns it. Handle `realpath` and `date`
parsing differences. `/bin/bash` on macOS is not a modern Bash,
Linux-only utilities need checks in macOS-compatible scripts, and CI does not share the
developer's `PATH`. Symlink-aware absolute paths come from `pwd -P` after `cd`, or from
product-owned application code.

## Verification and debugging

Run the configured syntax, ShellCheck, and shfmt commands. Run destructive or provider tests
only in a throwaway environment.

Production scripts gain no test-only flags, branches, or command replacements. When
debugging, start from the exact error and line Bash reports, run `bash -n` and ShellCheck,
reduce to the smallest reproducing block, and expose invisible characters with
`printf '%q\n'`. Trace with `bash -x` or a local `set -x` block with a `PS4` naming file, line, and function,
only while diagnosing, never around secrets, and never commit broad tracing, `trap DEBUG`, or stepping
code. Bash 4.4 supports `BASH_XTRACEFD`. A debug helper preserves the status it diagnoses.

Common causes follow. `unexpected EOF` is an unmatched quote, an unterminated here document,
a missing `fi`, `done`, or `esac`, or a CRLF ending hiding the delimiter. `too many arguments`
is an unquoted expansion inside `[ ... ]`. `event not found` is interactive history expansion
of `!`. A command behaving differently is an alias, function, builtin, or `PATH` collision,
found with `type -a`. Failure before the shebang is a BOM or CRLF.

## Refactoring existing scripts

Read the whole script and its sourced libraries, identify the caller contract (local, CI,
remote host, package script), and preserve behavior before changing style. Fix quoting and
argument arrays near the touched logic, and add explicit checks around dangerous commands.
Share a helper across the script family only when it has a real shared contract. Do not
convert a large script in one pass or change shebangs across a family without verifying the
runtime. Run the narrow shell lint and format command before the broader checks. A script
that is too complex moves its logic into application code, called directly.
