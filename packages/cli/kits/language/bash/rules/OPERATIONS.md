---
title: Bash Operations
---

# Bash Operations

Module ownership, deployment and publishing, remote commands, state, retries, and CI scripts.

## Module ownership and visibility

<!-- level: all -->

Each file owns one cohesive responsibility, and the directory supplies the family name.

- A file of only `source` statements is a barrel and is forbidden. A caller sources the exact
  owner it uses, and a library sources every repository file whose public functions it calls.
- A function beginning with `_` is private to its file and comes before the public functions. An
  executable file exposes only `main`.
- A sourced public function carries its family name, such as `release_prepare` or
  `cache_read_state`.
- A configuration owner starts with an owner-specific include guard that returns when its
  `<OWNER>_READY` marker is set. An ordinary library stays safe to source twice without one.
- Library constants use an owner-specific uppercase name and become readonly right after
  assignment.
- A function with one caller stays with that caller unless its file owns a real executable,
  external-system, security, persistence, or destructive boundary, which a `Boundary:` header
  names.

## Deployment and publishing pipelines

Deployment, publishing, and long-running scripts separate validation, planning, confirmation,
execution, readiness checks, and cleanup.

- Fail before any work when a required input, command, file, host, or secret is missing.
- Name the target explicitly: never infer production, a remote, a host, or an artifact from a
  branch name without a confirmation or a CI contract.
- A destructive or remote action asks for confirmation unless CI owns the guard.
- Use idempotent commands, stop at the first failed required step, and never hide a failure
  behind `|| true`.
- Check readiness after deploying or publishing, and print diagnostics a person can act on.
- Keep rollback and cleanup explicit, and delete no artifact or result as a side effect.
- Log enough to reconstruct what happened, without secrets.

```bash
# confirm_exact - Requires the user to type the expected value.
# Arguments:
#   Prompt label.
#   Expected response.
confirm_exact() {
  local label="$1"
  local expected="$2"
  local response

  printf '%s Type %s to continue: ' "${label}" "${expected}" >&2
  IFS= read -r response

  [[ "${response}" == "${expected}" ]]
}
```

## Remote commands

Copy a reviewed script to the remote host and invoke it with arguments. SSH joins its arguments
into one remote shell string, so local quoting does not keep remote argument boundaries. Validate
host, user, service, and path values before using them, never build a remote command from user
input, and give every remote call that can hang a timeout.

Bad:

```bash
ssh "$host" "cd $dir && docker compose up -d $service"
```

Good, for a remote login shell that is Bash:

```bash
printf -v remote_command 'bash -- %q %q %q' "${remote_script}" "${dir}" "${service}"
ssh -- "${host}" "${remote_command}"
```

## Persisted state

Never `source` generated state or pass it to `bash -c`. Write state in a fixed data format with an
exact key schema to a restricted file in the destination folder, and replace the previous state
with an atomic `mv`. A reader treats a malformed, duplicate, or unknown key as an error.

## Retries

Retry only an operation known to converge, such as a network pull or readiness polling, with a
bounded number of attempts. A retry never masks corrupt data, invalid credentials, a failed
migration, a syntax error, or a permission problem. Capture the status in the `else` branch,
because an `if` whose condition fails and that has no `else` returns zero:

```bash
if "$@"; then
  return 0
else
  status=$?
fi
```

## CI scripts

- Keep CI YAML thin, and put reusable logic in scripts that run without a prompt and that the
  task runner can start locally.
- Use explicit environment variables for CI-only behavior, pinned versions for every installed
  tool, and deterministic cache keys.
- A verification job does not change source files unless it is a formatter or code generation
  job.
- Write logs and reports to predictable artifact paths.
