# Hooks, CI and Runners

This document decides where checks run: git hooks, the CI workflow, and the task-runner surface.

## Stages

Every check declares one stage. The stage decides which hook runs it.

| Stage | Runs | Over | Hook |
| --- | --- | --- | --- |
| `commit` | checks that need only the source: formatters, linters, type checks, structure, naming, integrity | staged files; project-wide checks run when any staged file is in their scope | pre-commit |
| `push` | everything in `commit` plus checks that need a build, a daemon or the network: container scans, dependency audits, dead-code analysis, link crawls, generated-file freshness, coverage thresholds | the whole tree | pre-push |
| `manual` | checks that take minutes or need credentials: CodeQL, external link verification, image scans | the whole tree | none; `gspot check --stage manual` and the CI workflow |
| `message` | commitlint | the commit message | commit-msg |

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

## Hook managers

`[hooks] manager` selects one:

| Manager | gspot writes | When proposed |
| --- | --- | --- |
| `gspot` | `.gspot/hooks/pre-commit`, `pre-push`, `commit-msg`; sets `core.hooksPath = .gspot/hooks` | default |
| `lefthook` | a `gspot` block in `lefthook.yml` | `lefthook.yml` exists |
| `husky` | `.husky/pre-commit`, `pre-push`, `commit-msg` lines | `.husky/` exists |
| `none` | nothing | the person says no |

The gspot hook body:

```bash
#!/usr/bin/env bash
# Written by gspot. Run `gspot uninstall` to remove.
set -euo pipefail
exec "${GSPOT_BIN:-gspot}" check --staged "$@"
```

`init` resolves how the binary is found on this machine and writes it into the hook: `mise exec
-- gspot` under the mise runner, `bunx gspot` or `npx gspot` under an npm runner, the absolute
path otherwise. A hook that cannot find gspot prints the install command and fails; it never
passes.

`core.hooksPath` is per clone. `sync` sets it when hooks are on, so a fresh clone gets hooks on
the first `gspot sync`, which the runner's setup task calls. The pre-push hook calls `git lfs
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

| Surface | gspot writes | Tasks |
| --- | --- | --- |
| mise | `.mise/conf.d/gspot.toml` with `[tools]` pins and `[tasks]` | `gspot:check`, `gspot:fix`, `gspot:sync`, `gspot:doctor`, `gspot:setup` |
| npm, bun, pnpm | `scripts` entries in `package.json`, after a yes | `check`, `check:fix`, `sync`, `prepare` (runs `gspot sync`) |
| uv | `[tool.gspot]` is not used; `uv run gspot` works when gspot is a dev dependency through the npm wrapper, else the binary on `PATH` | none |
| none | nothing | none |

gspot never edits `mise.toml`. mise merges every file under `.mise/conf.d/`, so gspot owns one
file there and the repository's own pins and tasks stay untouched. A pin the repository already
set for a tool gspot needs is kept; `doctor` reports a version below the preset's floor.

Task names carry the `gspot:` prefix under mise so they cannot collide. Under npm the names are
`check` and `sync`; an existing script with that name is listed in the plan as replaced and
needs the yes.

`setup` (`gspot:setup` or `prepare`) runs `mise install` or the package manager's install, then
`gspot sync`, which installs the hooks and rule files.

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
the header and `sync --check` guards it.

Without mise in the repository the workflow installs gspot from the release asset by version and
runs `gspot doctor` first so a missing tool fails with its install hint.

## Reproduce lines

Every failing check prints the command that runs it alone: `gspot check typescript/eslint
--scope api`. The line is the same in the hook, in CI and in the terminal.

## Run record

Every run writes `.gspot/last.json`: version, stage, start time, duration, checks with status
(`ran`, `skipped`, `missing`), file counts, finding counts, duration; coverage counts; ignores
applied; baselines with counts; suppressions by form. `gspot check --json` prints it. The CI
workflow uploads a SARIF rendering with locations for tools that give them.
