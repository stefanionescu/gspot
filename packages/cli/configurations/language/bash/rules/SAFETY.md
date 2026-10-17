# Bash Safety

Read this rule when a shell script runs commands, handles paths, downloads files, or deletes files.

## Calling commands

Use fixed command names with argument arrays, never strings built from input. Never pass
untrusted input to a shell. Never use `bash -lc` in repository scripts. A function that runs a
caller-supplied command takes it and its arguments after `shift` and invokes `"$@"`.

Check uncommon commands with `command -v` before a long-running, destructive, publishing, or
error-handling path depends on them. Prefer builtins and parameter expansion to external
commands for string and arithmetic work, and pass files directly rather than through
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

Treat process names as advisory information, never authorization. Stop and restart paths kill only
process ids that the owning script family recorded, found through the service manager, a `PID` file, or
`pgrep -x`, never `ps | grep`. A script that starts background jobs saves every `PID`, waits for
each job, captures its status, and writes its output to a separate file. It bounds its
fan-out and kills owned children on `INT`, `TERM`, and `EXIT`. `sudo command > file` redirects
as the current user, and a glob in `sudo command /path/*` expands before `sudo` runs.
Send privileged writes through `sudo tee`, and keep the shell string you pass to `sudo` a fixed
literal with no input.

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

Use parameter expansion for string edits. JSON goes through `jq`, and YAML through `yq` or
a project-owned parser. Never parse JSON, YAML, XML, HTML, plist, or xcodebuild output
with ad hoc `grep | sed | awk` unless the script controls the input and the format has no complex structure.
Prefer machine output modes such as JSON, `NUL`, or explicit format flags and never parse process lists,
pretty tables, progress bars, or localized text by fixed field numbers. Quote `tr` character
classes and pin `LC_ALL=C` when converting case. macOS and GNU `sed -i` differ; a committed
script rewrites through a temporary file unless its documentation restricts it to one system.

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

Download with `curl --fail --show-error --silent --location` into an explicit file. Set timeouts
with the options of the tool, such as `--connect-timeout` plus `--max-time`, or SSH `ConnectTimeout`.
Do not use GNU `timeout`, which macOS lacks. Download executable content, verify it against an
independently obtained checksum or signature, and only then run it.

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

Create temporary paths with `mktemp` or `mktemp -d` under the system location or a dedicated
project folder, never with predictable names. Register cleanup immediately after creation.
Put downloaded, copied, or generated content in a temporary file, validate it with the real
parser, and replace the destination with `mv`. The file keeps the restrictive permissions
`mktemp` gave it unless deployment needs others. Remove failed artifacts unless the script
documents keeping them. Acquire a lock atomically with `mkdir` on a folder that stores the holder
`PID`, or with `noclobber` redirection, never with a `test` followed by a create.

Stop commands remove only what the script created. Validate a cleanup path from
input or persistent state against its permitted root. Reject empty values, `/`,
the repository root, `$HOME`, symlinks, and anything outside the folder the script created. Keep a `mktemp -d` result
exactly. Never widen the path to its neighbors. `|| true` never follows a destructive
step or a required installation, publishing, build, or runtime command.

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

Put recursive deletes in one script. To accept the `bash/safety` finding for that script, follow the suppression
rules.
Validate its cleanup path against the approved root folder:

```bash
# remove_build_dir: Removes the build child of the approved root folder.
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
system-specific branch with the operation that owns it. Handle `realpath` and `date`
parsing differences. macOS `/bin/bash` runs an old Bash version. Linux-only utilities need
checks in scripts that also run on macOS. CI does not share the `PATH` of the developer. Symlink-aware absolute paths come from `pwd -P` after `cd`, or from
product-owned application code.

## Verification and debugging

Run the configured syntax, ShellCheck, and shfmt commands. Run destructive or provider tests
only in a throwaway environment.

Production scripts gain no test-only flags, branches, or command replacements. When
debugging, start from the exact error and line Bash reports. Run `bash -n` and ShellCheck,
reduce to the smallest reproducing block, and expose invisible characters with
`printf '%q\n'`.

Trace with `bash -x` or a local `set -x` block whose `PS4` names file, line, and function,
only while you debug. Never commit broad tracing, `trap DEBUG`, or stepping
code. Bash 4.4 supports `BASH_XTRACEFD`. A debug helper preserves the status it diagnoses.

`unexpected EOF` indicates an unmatched quote, an unterminated here document,
a missing `fi`, `done`, or `esac`, or a CRLF ending hiding the delimiter.

`too many arguments` indicates an unquoted expansion inside `[ ... ]`. `event not found` indicates interactive history expansion
of `!`. Use `type -a` to find an alias, function, builtin, or `PATH` collision when a command behaves differently.
Failure before the shebang indicates a byte order mark (BOM) or CRLF.

## Refactoring existing scripts

Read the whole script and its sourced libraries. Identify the caller interface: local, CI,
remote host, or package script. Preserve behavior before you change style.

Fix quoting and argument arrays near the touched logic, and add explicit checks around dangerous commands.
Share a helper across the script family only when it has a real common contract. Do not
convert a large script in one pass or change shebangs across a family without verifying the
runtime. Run the narrow shell lint and format command before the broader checks. Move complex script
logic into application code and call it directly.
