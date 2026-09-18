# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI workflow, and the task-runner surface.

## Stages

Every check declares one stage. The stage decides which hook runs it.

| Stage     | Runs                                                                                                                                                                                              | Over                                                                         | Hook                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `commit`  | checks that need only the source: formatters, linters, type checks, structure, naming, integrity                                                                                                  | staged files; project-wide checks run when any staged file is in their scope | pre-commit                                             |
| `push`    | everything in `commit` plus checks that need a build, a daemon or the network: container scans, dependency audits, dead-code analysis, link crawls, generated-file freshness, coverage thresholds | the whole tree                                                               | pre-push                                               |
| `manual`  | checks that take minutes or need credentials: CodeQL, external link verification, image scans                                                                                                     | the whole tree                                                               | none; `gspot check --stage manual` and the CI workflow |
| `message` | commitlint                                                                                                                                                                                        | the commit message                                                           | commit-msg                                             |

A check requires nothing, or one of `build`, `docker`, `network`. A requirement puts the check in
`push` at least. A `docker` requirement with no daemon fails; there is no silent pass.

## Staged mode

`gspot check --staged`:

1. Reads `git diff --cached --name-only --diff-filter=ACMRT`.
2. Runs `commit`-stage file checks over the staged files that each check claims.
3. Runs `commit`-stage project checks (`tsc`, `pyright`, `integrity/*`) when any staged file is
   in their scope, or when `gspot.toml` or a generated file is staged.
4. Enforces the per-file baseline: a staged file's count for a baselined rule must not grow.
5. Fails when a `.env*` file is staged unless it is a template.

Editing `gspot.toml` or a generated config re-runs every check in the scopes it governs. A lint
policy change never waits for push to be checked.

Staged mode reads the working-tree content of each staged path, not the staged blob. There is
no stash dance: it is the one thing hooks get wrong most, and the cost is one honest line. When a
staged file also has unstaged changes, the output says `checked working tree; N files have
unstaged changes` so nobody mistakes the verdict for a verdict on the commit alone.

## Hook managers

`[hooks] tool` selects one:

| Manager    | gspot writes                                                                              | When proposed         |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------- |
| `gspot`    | `.gspot/hooks/pre-commit`, `pre-push`, `commit-msg`; sets `core.hooksPath = .gspot/hooks` | default               |
| `lefthook` | a `gspot` block in `lefthook.yml`                                                         | `lefthook.yml` exists |
| `husky`    | `.husky/pre-commit`, `pre-push`, `commit-msg` lines                                       | `.husky/` exists      |
| `none`     | nothing                                                                                   | the person says no    |

The gspot hook body:

```bash
#!/usr/bin/env bash
#
# Written by gspot. Run `gspot uninstall` to remove.
# Runtime: Bash 4.0+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

main() {
    local -a gspot_command
    read -ra gspot_command <<<"${GSPOT_BIN-}"
    if [[ ${#gspot_command[@]} -eq 0 ]]; then
        gspot_command=('mise' 'exec' '--' 'gspot')
    fi
    exec "${gspot_command[@]}" check --staged "$@"
}

main "$@"
```

The hook is a Bash script gspot's own bash preset checks, so it carries the header, strict mode
and entry point the interpreter policy asks of every executable.

`init` resolves how the binary is found on this machine and writes it into the hook: `mise exec
-- gspot` under the mise runner, `bunx gspot` or `npx gspot` under an npm runner, the absolute
path otherwise. Each of these resolves the version the repository pins, not a global copy. A
hook that cannot find gspot prints the install command and fails; it never passes.

Hooks that exist and were not written by gspot (a `.githooks/` directory of hand-written scripts,
a `.husky/` set the person declined to hand over) are never deleted. `init` lists them under "no
longer runs; delete when ready" once `core.hooksPath` points elsewhere. A person who keeps their
own hooks chooses `[hooks] tool = "none"` and calls `gspot check --staged` from them.

`core.hooksPath` is per clone. `apply` sets it when hooks are on, so a fresh clone gets hooks on
the first `gspot apply`, which the runner's setup task calls. The pre-push hook calls `git lfs
pre-push` first when git-lfs is installed.

On Windows, git runs hooks through the `sh` that Git for Windows installs, so the same hook
files work. gspot marks them executable through `git update-index --chmod=+x` rather than a
file-system bit, which Windows lacks. The hook resolves the binary through `GSPOT_BIN` or the
runner's exec, never through a hard-coded Unix path.

Skips: `gspot.local.toml` `skip` for one machine, `--skip` for one run. Both print. There are no
environment variables that turn a hook off; `--no-verify` is git's own bypass and CI is the
second line.

## Task runner surface

The runner is a surface for humans and editors. Every task calls gspot; the graph lives in gspot.

| Surface        | gspot writes                                                                                                                       | Tasks                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| mise           | `.config/mise/conf.d/gspot.toml` with `[tools]` pins and `[tasks]`                                                                 | `gspot:check`, `gspot:fix`, `gspot:apply`, `gspot:doctor`, `gspot:setup` |
| npm, bun, pnpm | `scripts` entries in `package.json`, after a yes                                                                                   | `check`, `check:fix`, `apply`, `prepare` (runs `gspot apply`)            |
| uv             | `[tool.gspot]` is not used; `uv run gspot` works when gspot is a dev dependency through the npm wrapper, else the binary on `PATH` | none                                                                     |
| none           | nothing                                                                                                                            | none                                                                     |

gspot never edits `mise.toml`. mise merges every file under `.config/mise/conf.d/` (the one
`conf.d` directory mise reads), so gspot owns one file there and the repository's own pins and
tasks stay untouched. `init` runs `mise trust` on that file before the install step, because mise
refuses a configuration file nobody has trusted. A pin the repository already
set for a tool gspot needs is kept; `doctor` reports a version below the preset's floor. The
gspot file also pins gspot itself (`gspot = "0.5.0"` through `ubi:`), which is what `mise exec`
and the hook resolve.

A `.tool-versions` file counts as mise being present, because mise reads it. proto, volta, nvm,
pyenv and asdf without mise are not runners gspot writes to: `init` reports them, proposes mise,
and falls back to the package manager surface when the person declines.

Task names carry the `gspot:` prefix under mise so they cannot collide. Under npm the names are
`check` and `apply`; an existing script with that name is listed in the plan as replaced and
needs the yes.

`setup` (`gspot:setup` or `prepare`) runs `mise install` or the package manager's install, then
`gspot apply`, which installs the hooks and rule files.

## CI workflow

`[ci] provider = "github"` writes `.github/workflows/gspot.yml`:

```yaml
name: gspot
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned sha>
        with: { fetch-depth: 0 }
      - uses: jdx/mise-action@<pinned sha>
      - run: mise run gspot:setup
      - run: gspot check --json > gspot.json
      - run: gspot check --stage manual
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
      - uses: github/codeql-action/upload-sarif@<pinned sha>
        if: always()
        with: { sarif_file: .gspot/last.sarif }
  swift:
    if: <the selection includes swift>
    runs-on: macos-latest
    steps: [checkout, mise, gspot:setup, gspot check --scope ios]
```

One job, the same `push`-stage set the hook runs, plus `manual` on the default branch. A macOS
job appears only when a Swift scope exists. `[ci] platforms = ["ubuntu", "windows"]` adds a
Windows job that runs the same `check`; gspot's own CI runs all three. Actions are pinned by SHA; `actionlint` and `zizmor`
run over the workflow in the `config-files` preset. The workflow is a generated file: it carries
the header and `apply --check` guards it.

Without mise in the repository the workflow installs gspot from the release asset by version and
runs `gspot doctor` first so a missing tool fails with its install hint.

## Reproduce lines

Every failing check prints the command that runs it alone: `gspot check typescript/eslint
--scope api`. The line is the same in the hook, in CI, and in the terminal.

## Run record

Every run writes `.gspot/last.json`: version, stage, start time, duration, checks with status
(`ran`, `skipped`, `missing`), file counts, finding counts, duration; coverage counts; ignores
applied; baselines with counts; suppressions by form. `gspot check --json` prints it. The CI
workflow uploads a SARIF rendering (`node-sarif-builder`) with locations for tools that give them.

A hook never runs `--fix`. When a person runs `gspot check --fix` themselves with files staged,
the fixes land in the working tree and are not staged for them, the way lint-staged's
`--fail-on-changes` behaves; the output names the files that changed.
