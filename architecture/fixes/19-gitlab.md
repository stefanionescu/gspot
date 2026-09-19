# The Command Surface and GitLab

Row 23b of the build order. [00-delete-first.md](00-delete-first.md) deletes the commands and
flags that leave. This file builds what D-129 to D-133 add.

## K-95: one name for one idea on the command line

Closes K-95 and K-98.

**What is wrong.** The flags grew one command at a time. A run that writes nothing is `--check`
on one command, `--dry-run` on another, and `--plan` on a third. A refusal is the value `none` on
three flags and a `--no-` flag on two.

**Target.** The table of [02-cli.md](../02-cli.md): `--dry-run` on `init`, `upgrade`,
`uninstall`, and `check --fix`; `--no-ci`, `--no-hooks`, `--no-runner`, `--no-rules`, and
`--no-install`; `check --changed` as `--since` the upstream branch (D-123);
`[hooks] push = "changed"` or `"all"`.

**Files.** `commands/*.ts`, `program.ts`, `run/check-command.ts`, `policy/schema.ts`.

**Logic.** `--changed` resolves `@{upstream}` and falls back to the default branch of the remote.
The global flags `--json`, `--quiet`, `--verbose`, and `--no-color` are read once in `program.ts`
(K-98).

**What goes.** `--at`, which becomes `--stage`. `--check`, `--plan`, and every `none` value go.

**Tests.** A unit test walks the program and fails a flag name outside the table.

**Done when.** It passes, and the manual is generated from the same program.

## K-96: GitLab beside GitHub

**What is wrong.** `--ci` takes `github` or `none`. A repository on GitLab gets a
`.github/workflows/` folder.

**Target.** `--ci` takes `github` or `gitlab`, and the default follows the repository (D-133). For
GitLab gspot writes `.gitlab/ci/gspot.yml`, and the plan shows the one `include:` line for the
developer to add. gspot never edits `.gitlab-ci.yml`. A repository whose CI already runs a lint
job is told so and gets no second job.

**Files.** New `emit/gitlab.ts`, `emit/workflow.ts`, `repository/existing-tooling.ts`,
`policy/schema.ts`.

**Logic.** Detection reads a `.gitlab-ci.yml` file or a GitLab remote, then a `.github/` folder or
a GitHub remote. The GitLab job runs `gspot install`, caches `.gspot/cache/`, and uploads a code quality report.
GitLab reads the CodeClimate format there and not SARIF, so every run writes that third
format beside the JSON and the SARIF file ([23-scenarios.md](23-scenarios.md), K-277).

**What goes.** Nothing.

**Tests.** A planted install with `--ci gitlab`, whose file `glab ci lint` accepts in the
`manual` job of CI.

**Done when.** It passes.
