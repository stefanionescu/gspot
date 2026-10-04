---
title: Bash Operations
---

# Bash Operations

Module ownership, deployment and publishing, remote commands, state, and retries.

## Module ownership and visibility

<!-- level: all -->

Each file owns one cohesive responsibility, and the directory supplies the family name.

- A sourced public function carries its family name, such as `release_prepare` or
  `cache_read_state`.
- A function with one caller lives in the caller's file.

## Deployment and publishing pipelines

Deployment, publishing, and long-running scripts separate validation, planning, confirmation,
execution, readiness checks, and cleanup.

- Fail before any work when a required input, command, file, host, or secret is missing.
- Name the target explicitly: never infer production, a remote, a host, or an artifact from a
  branch name without a confirmation or a CI contract.
- A destructive or remote action asks for confirmation unless CI owns the guard.
- Use idempotent commands and stop at the first failed required step.
- Check readiness after deploying or publishing, and print diagnostics a person can act on.
- Keep rollback and cleanup explicit, and delete no artifact or result as a side effect.
- Log enough to reconstruct what happened, without secrets.

```bash
# confirm_exact: Requires the user to type the expected value.
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
