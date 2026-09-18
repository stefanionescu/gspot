---
layer: language
preset: bash
title: Bash Operations
---

# Bash Operations

Module ownership across a script family, deployment and publishing pipelines, and CI scripts.
Script structure and options are in the Bash file; commands, processes, and secrets in Bash Safety.

## Module ownership and visibility

Each file owns one cohesive responsibility. Directory structure supplies the family or domain `unenforced`
name.

Rules:

- A sourced file containing only `source` statements is a barrel and is forbidden. Callers
  source the exact owner they use. `enforced-by: structure/shell-interpreter`
- A file and a sibling directory must not share a stem. Move the file into the directory and give
  it a role name. `unenforced`
- A function beginning with `_` is private to its defining file, appears before the public
  functions, and is never called from another file. `unenforced`
- An executable file exposes only `main`; every other function in that file is private. `enforced-by: structure/shell-interpreter`
- A sourced public function uses a family or domain namespace, such as `server_start`,
  `restart_read_state`, or `deploy_prepare_release`. `enforced-by: structure/shell-interpreter`
- Library files explicitly source every repository file whose public functions they call. Do not
  rely on an entrypoint's source order or a transitive source. `enforced-by: structure/shell-interpreter`
- Shell configuration owners start with an owner-specific include guard before constants or
  dependency sources. The guard returns when its `_CFG_<OWNER>_READY` marker is set, then
  immediately declares that marker readonly. `unenforced`
- Ordinary function libraries do not use blanket include guards. They remain safe when direct
  dependency diamonds source them more than once. `enforced-by: structure/shell-interpreter`
- Library-level behavioral constants use an owner-specific uppercase name and are readonly
  immediately after assignment. Source-path discovery variables are load-time values, not
  behavioral constants, and remain reassignable. `enforced-by: structure/shell-interpreter`
- Do not create a file for one function used by one caller. Keep that function with its caller
  unless the file owns a real executable, external-system, security, persistence, or
  destructive-operation boundary. `enforced-by: structure/shell-interpreter`
- A retained one-function, one-caller boundary includes a `Boundary:` header that states the
  concrete boundary. A comment is not sufficient when the implementation does not own that
  boundary. `unenforced`
- Do not split one concept across parallel directory owners, such as both `restart/` and
  `runtime/restart/`. `unenforced`

Preferred order inside the function section:

1. Private parsing and validation functions. `unenforced`
2. Private operation functions. `unenforced`
3. Public library functions. `enforced-by: structure/shell-interpreter`
4. `main` for executable scripts. `enforced-by: structure/shell-interpreter`

## Deployment and publishing pipelines

Deployment, publishing, build, benchmark, and long-running runtime scripts need stricter structure
than local utility scripts.

Rules:

- Separate validation, planning, confirmation, execution, readiness checks, and cleanup. `unenforced`
- Fail before doing work when required inputs, commands, files, hosts, artifact directories, or
  secrets are missing. `enforced-by: secrets/gitleaks`
- Make the target explicit. Do not infer a production environment, a remote repository, a
  model, an artifact path, or a host from a branch name without a clear confirmation or CI
  contract. `enforced-by: structure/shell-branches`
- Make destructive or remote publishing actions require explicit confirmation unless CI owns the
  guard. `enforced-by: structure/shell-safety`
- Keep pipeline state readable: environment, host, service, artifact, commit, image tag,
  migration range, output directory, and config path. `unenforced`
- Use idempotent commands. `unenforced`
- Check readiness after deploying, publishing, or long-running setup and surface actionable
  diagnostics on failure. `enforced-by: structure/shell-safety`
- Do not continue to later steps after a required step fails. `unenforced`
- Do not hide partial failure by using `|| true` around deploy, build, warmup, test, or publish
  commands. `enforced-by: structure/shell-safety`
- Use bounded retries only for known retryable operations. `unenforced`
- Keep rollback, teardown, and cleanup commands explicit. Do not invent automatic rollback unless
  the platform supports it and it has been verified. Do not delete artifacts, results, or
  checkpoints as an implicit side effect. `unenforced`
- Log enough to reconstruct what happened without printing secrets. `enforced-by: secrets/gitleaks`

Recommended flow:

```text
parse args
read environment
validate required commands
validate required files
validate secrets without printing values
resolve target
show summary
confirm if interactive or destructive
build or locate artifact
upload, sync, or publish
apply migrations or config
restart or reload service
wait for readiness
verify the published artifact
print final state
```

Confirmation helper:

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

Remote commands:

- Prefer copying a reviewed script to the remote host and invoking it with arguments. `enforced-by: structure/shell-ssh-blocks`
- Avoid interpolating local variables into remote shell strings. `enforced-by: structure/shell-ssh-blocks`
- If `ssh host command args...` is used, pass fixed commands and quoted arguments. `enforced-by: bash/shellcheck`
- Treat remote command strings as a last resort. Quote or escape every argument deliberately for
  the shell that will parse it. `enforced-by: bash/shellcheck`
- Do not build remote shell fragments from user input. `enforced-by: structure/shell-ssh-blocks`
- Validate hostnames, usernames, service names, container names, unit names, variants, and remote
  paths before using them in remote commands. `enforced-by: structure/shell-ssh-blocks`
- Use native connection and command timeouts for remote calls that can hang. `enforced-by: structure/shell-ssh-blocks`

Bad:

```bash
ssh "$host" "cd $dir && docker compose up -d $service"
```

Better:

```bash
ssh -- "${host}" bash -- "${remote_script}" "${dir}" "${service}"
```

Checkpoint state:

- Use checkpoint files only for idempotent, resumable workflows where repeating a completed
  expensive step is wasteful. `unenforced`
- Scope checkpoint paths by script name, date or run ID, target environment, and input identity
  so stale success markers cannot skip required work. `unenforced`
- Mark a checkpoint successful only after validation and final replacement have completed. `unenforced`
- Invalidate or ignore checkpoint state on interruption unless partial progress is explicitly
  safe to resume. `unenforced`
- Do not use checkpoints to skip required validation, confirmation, or readiness checks. `unenforced`

Persisted runtime state:

- Never `source` generated state or pass it to `bash -c`. `enforced-by: bash/shellcheck`
- Use a fixed, non-executable data format with an exact key schema. `enforced-by: structure/shell-interpreter`
- Reject delimiters or newlines that the format cannot represent. `enforced-by: bash/shellcheck`
- Write state to a permission-restricted temporary file in the destination directory, then
  replace the previous state with an atomic `mv`. `unenforced`
- Readers treat malformed, duplicate, or unknown state keys as errors. `enforced-by: structure/duplicate-functions`

Retry pattern:

```bash
# retry_retryable - Runs a retryable command with bounded attempts.
# Arguments:
#   Step name for logs.
#   Attempt count.
#   Delay seconds.
#   Command and arguments.
retry_retryable() {
  local step_name="$1"
  local attempts="$2"
  local delay_seconds="$3"
  shift 3

  local attempt
  local status

  [[ "${attempts}" =~ ^[1-9][0-9]*$ ]] || return 2
  [[ "${delay_seconds}" =~ ^[0-9]+$ ]] || return 2

  for (( attempt = 1; attempt <= attempts; attempt++ )); do
    printf 'step=%s attempt=%s/%s status=running\n' \
      "${step_name}" "${attempt}" "${attempts}" >&2

    if "$@"; then
      printf 'step=%s attempt=%s/%s status=success\n' \
        "${step_name}" "${attempt}" "${attempts}" >&2
      return 0
    fi

    status=$?
    printf 'step=%s attempt=%s/%s status=failed exit=%s\n' \
      "${step_name}" "${attempt}" "${attempts}" "${status}" >&2

    if (( attempt == attempts )); then
      return "${status}"
    fi

    sleep "${delay_seconds}"
  done
}
```

Use retries for:

- retryable network pulls; `unenforced`
- readiness polling; `unenforced`
- "eventually consistent" provider APIs; `unenforced`
- remote service startup checks. `enforced-by: structure/shell-ssh-blocks`

Do not use retries to mask:

- corrupt data; `unenforced`
- invalid credentials; `enforced-by: secrets/gitleaks`
- failed migrations or failed artifact validation; `unenforced`
- syntax errors; `unenforced`
- missing files; `unenforced`
- failed validation; `unenforced`
- failing checks; `unenforced`
- permission problems. `unenforced`

## CI scripts

Rules:

- Keep CI YAML thin. Put reusable logic in scripts. `enforced-by: structure/shell-script-policy`
- CI scripts must be non-interactive by default. `unenforced`
- Use explicit environment variables for CI-only behavior. `unenforced`
- Print the versions of important tools when diagnosing setup issues. `enforced-by: structure/shell-safety`
- Keep cache key creation deterministic. `unenforced`
- Do not install global tools without pinning versions. `enforced-by: bash/shellcheck`
- Do not mutate source files in verification jobs unless the job is explicitly a formatter or
  codegen job. `unenforced`
- Capture logs and reports to predictable artifact paths. `unenforced`
- Do not call broad, expensive, or mutating checks from a narrow task unless the owning rule file
  requires it. `unenforced`
- Every CI entrypoint accepts enough flags to run locally through the task runner. `unenforced`
