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

## K-284: one way to turn a thing off, and a way to turn one check on

Closes K-284 and K-285.

**What is wrong.** `tools.<name>.enabled = false` and an `[[ignore]]` with no rule both remove a
check. `gspot allow typos` writes a list that `gspot set` writes. A repository at `recommended`
cannot turn on one check of the level `all`. `gspot profile save` leaves every `[[ignore]]` out,
so a rule a team turned off everywhere is lost in the next repository.

**Target.** D-160 and D-161. Fifteen commands, and four of them write the config:
`ignore`, `set`, `add`, and `remove`.

**Files.** Deleted: `commands/allow.ts`, `policy/allow-command.ts`. `commands/profile.ts` becomes
`commands/export.ts`, and `profile/save.ts` becomes `profile/export.ts`. Changed:
`policy/schema.ts`, `presets/levels.ts`, `profile/schema.ts`,
`output/reporter.ts`, and the manifests of javascript and python.

**Logic.** `isPlanned` in `levels.ts` plans a check whose level is within the level of the
repository, or whose id is in `extra_checks`. `emit/tool-packages.ts` and `tool-environment.ts` leave out a tool
whose every check has an `[[ignore]]` with no rule and no paths.

The `help:` line of a spelling finding prints `gspot set tools.typos.words <word>`. The profile
schema accepts an `[[ignore]]` with no `paths`, and `export` prints each entry it leaves out.

**What goes.** The key `enabled` of every tool, the command `allow`, the command noun `profile`,
and nothing else.

**Tests.** A planted repository at `recommended` turns on `structure/single-file-folder` through
`extra_checks`, and the next run reports it. An exported profile with one pathless ignore starts a
second repository with that rule off. A tool with every check ignored is absent from
`.gspot/package.json`.

**Done when.** The three cases pass, and `gspot --help` lists fifteen commands.

## K-287: one word for the name of a thing

Closes K-287, K-288, and K-289.

**What is wrong.** The help text and the messages say check id, preset id, rule id, and setting
key for one idea. A manifest names a preset and a check by `id`, and a tool by `name`. Four
commands rewrite many lines with no `--dry-run`. A reason
is required on every ignore, so turning one rule off takes a sentence.

**Target.** D-163 and D-164.

**Files.** `presets/manifest-schema.ts` and all 49 manifests (`id` becomes `name`),
`commands/*.ts`, `output/messages.ts`, `policy/schema.ts`,
`policy/loosening.ts`, `config/reasons.ts`.

**Logic.** Usage lines show `<check>`, `<preset>`, `<rule>`, and `<setting>`. `install`, `apply`, `add`,
and `remove` take `--dry-run`, and each prints its plan and writes nothing,
through the plan text `init` already has. `reason` is optional in the schema. `loosening.ts` and the
refused reasons of `reasons.ts` apply only where `require_reasons = true`.

**What goes.** The words id and key in everything a person reads, and the required reason.

**Tests.** A unit test walks the help text and the messages and fails on `id` and `key`. A
planted `gspot ignore` with no reason writes the entry. The same command with `require_reasons`
on exits 2.

**Done when.** The three pass.

## K-291: check one file, and leave a project out

**What is wrong.** `gspot check` takes a check name where every lint tool takes paths, so
`gspot check src/app.ts` is an unknown check. A developer who wants gspot in two of the five
projects of a monorepo has no key for that.

**Target.** D-166. `gspot check [<path>...]`, `--only <check>`, and `exclude` in `gspot.toml`.

**Files.** `commands/check.ts`, `run/check-command.ts`, `run/plan.ts`, `policy/schema.ts`,
`repository/tracked.ts`, `lifecycle/init/questions.ts`, `run/reproduce.ts`.

**Logic.** `plan.ts` keeps the files under the given paths, and then the checks that claim them.
A path that is a scope plans the whole-project checks of that scope too. `tracked.ts` drops the
files under `exclude` before anything else reads them, so no check, no count, and no `doctor`
line sees them. The first question of `init` in a monorepo lists the projects found, and an
unticked one goes into `exclude`. The reproduce line is `gspot check <path> --only <check>`.

**What goes.** The check name as a positional argument, and `--scope` on `check`. `--scope` stays
on `add`, `remove`, and `set`, where it names the scope a change is written to.

**Tests.** A planted monorepo of three projects takes two at `init`, and `gspot check` reads no
file of the third. `gspot check api/src/a.ts --fix` changes that one file.

**Done when.** Both pass.
