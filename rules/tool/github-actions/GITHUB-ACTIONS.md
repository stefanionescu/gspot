---
layer: tool
preset: cloudflare
title: GitHub Actions
---

# GitHub Actions

## Workflow shape

- One workflow per purpose (`ci.yml`, `release.yml`, `deploy.yml`). File names are kebab-case. `enforced-by: config-files/actions`
- Every job has `timeout-minutes`. Every workflow that can run twice for one ref has a
  `concurrency` group with `cancel-in-progress` for pull requests. `enforced-by: config-files/actions`
- Jobs run on a pinned runner image (`ubuntu-24.04`), not `ubuntu-latest`. `enforced-by: config-files/actions`
- Steps that run project commands call the task runner (`mise run check`, `gspot check`), not a
  copy of the command. The workflow does not own logic the repository already has. `enforced-by: config-files/actions`
- No `continue-on-error` without a reason comment. No `if: always()` on a step that publishes
  results of a failed job. `enforced-by: config-files/actions`

## Actions

- Every third-party action is pinned to a full commit SHA with the version in a trailing comment:
  `uses: actions/checkout@<sha> # v4.2.2`. Tags and branches are not pins. `enforced-by: config-files/actions`
- First-party actions from the repository are referenced by path. `enforced-by: config-files/actions`
- An action that needs a token gets the narrowest token, never the default `GITHUB_TOKEN` with
  write permissions when read is enough. `enforced-by: config-files/actions`

## Permissions

- `permissions:` is set at the workflow level to `contents: read` and raised per job only for
  what that job does (`pull-requests: write` to comment, `id-token: write` for OIDC). `enforced-by: config-files/actions`
- No `pull_request_target` that checks out the pull request head. No workflow that runs
  untrusted code with secrets available. `enforced-by: config-files/actions`
- Secrets are read through `${{ secrets.NAME }}` into an `env` for the one step that needs them.
  Never echoed, never passed as command-line arguments, never written to files that outlive the
  step. `enforced-by: config-files/actions`
- Untrusted values (`github.event.*` titles, bodies, branch names) go through `env`, never
  interpolated into `run:` scripts. `enforced-by: config-files/actions`

## Scripts

- A `run:` block is short. Anything past a few lines is a script in the repository that follows
  the shell rules and passes ShellCheck. `enforced-by: config-files/actions`
- `run:` uses `bash` with `set -euo pipefail` (the default `shell: bash` does this). `enforced-by: config-files/actions`
- Caches are keyed on the lockfile hash and the runtime version. Restore keys never match a
  different lockfile. `enforced-by: config-files/actions`

## Outputs

- Artifacts and summaries name the job and the ref. Retention is set explicitly. `enforced-by: config-files/actions`
- A workflow that deploys is the only workflow with deploy credentials and runs on a protected
  environment with a reviewer. `enforced-by: config-files/actions`
