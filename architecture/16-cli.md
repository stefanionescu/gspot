# Command Surface

One binary, `gspot`, version 0.1.0 first. Fourteen commands. Each is a verb over
one piece of state, and no two share a job. Every command, flag and behaviour
here is one that `git`, `cargo`, `ruff`, `mise`, `gh` or `pre-commit` already
has, named the way its source names it. Policy lives in `gspot.toml` and is
edited there. No command writes to it.

One policy runs through every command: **gspot owns a job or does not touch
it.** When gspot owns linting in a repository, nothing else lints it. No parallel
configuration, no second hook runner, no tool left behind that a gspot check
replaced.

## The tree

```text
gspot
  init          [--yes] [--rules yes|no]
                [--scope <name=path>] [--presets <ids>] [--declare <ext=reason>]
                [--runner mise|bun|npm] [--migrations none|all|<version>]
                [--hooks yes|no] [--ci none|github|gitlab|buildkite]
  uninstall
  generate      [--check]
  upgrade       [--check] [--to <version>]
  install
  doctor
  check         [<id>] [--stage <name>] [--scope <name>] [--inspects <name>]
                [--since <ref>] [--skip <id>] [--unchecked]
  fix           [<id>]
  report        [--failed] [--sarif] [--json]
  coverage      [--diff]
  config        [<tool>]
  explain       <rule>
  hooks         install | uninstall
  completion    bash | zsh | fish

global:  --help  --version  --quiet  --verbose  --no-color
env:     NO_COLOR  CI
exit:    0 passed   1 the gate failed   2 gspot could not run
```

## Set up and keep up

| Command | Does |
| --- | --- |
| `gspot init` | Detects scopes, languages, frameworks, libraries, tools, runner, existing tool configuration, hooks and rules. Prints the plan: what it read, what it carries into `gspot.toml`, what it deletes, what it replaces. Asks once: "gspot will own linting in this repository. Continue?" Default no; no writes nothing and exits 0. Yes writes `gspot.toml`, every config, the tasks, the hooks and `rules/`, and removes what it replaced. Refuses to overwrite an existing `gspot.toml`. The takeover table is in [17-lifecycle.md](17-lifecycle.md). |
| `gspot init --yes` | Answers every question with the proposal, including the one above. The one-command install, and the form CI and scripts run. |
| `gspot init --scope` `--presets` `--declare` `--runner` `--migrations`  `--hooks` `--ci` | One flag per question. A flag answers its question; `--yes` answers the rest. With no terminal, a question no flag answers is exit 2. |
| `gspot init --rules yes\|no` | Whether to install the rule files. Checks and rules are independent. |
| `gspot uninstall` | Removes everything `init` wrote and `install` downloaded: every generated file, the tasks, the hooks and `core.hooksPath`, `.gspot/` including the tool cache, `CLAUDE.md`, `AGENTS.md`, `rules/` except `rules/project/`, and the managed blocks in `.gitignore`, `.gitattributes` and `.prettierignore`. Leaves `gspot.toml` and `rules/project/`. Restores nothing; git holds the state before `init`. |
| `gspot generate` | Re-renders every generated file from `gspot.toml`. Idempotent. Run after any edit to `gspot.toml`. A preset added to an area with findings gets baselines the same way `init` writes them. A preset whose requirement is absent, or whose removal breaks another, is refused with the exact line to add or remove; `generate` never edits `gspot.toml`. |
| `gspot generate --check` | Fails when a generated file was hand-edited, a glob matches nothing, a referenced file is missing, a config has no reader, or a CI workflow still runs a tool gspot owns. Runs at pre-commit. |
| `gspot upgrade` | Moves to the newest gspot, re-renders, prints what changed, writes a baseline for every rule that arrives with findings. Never writes `gspot.toml`, never commits. `--check` prints without writing. `--to <version>` moves to an exact version, downward included. |
| `gspot install` | Downloads every tool in `tools.lock` into `.gspot/bin/` and verifies each SHA-256, on every run, replacing anything that fails. Sets `core.hooksPath` when `[gate] hooks = true`, so a fresh clone has hooks after the runner's install task. Under the mise runner it writes the pins and mise downloads. gspot runs only the tools it installed, plus the host tools a check declares it cannot ship: Xcode, Docker, the system Bash. The only command that touches the network by default. |
| `gspot doctor` | What is missing, which checks that blocks, what coverage is lost, whether a newer gspot exists, and which detected technologies have no preset enabled. Detection re-run on a repository that already has `gspot.toml`, since `init` refuses to. |

## Run

| Command | Does |
| --- | --- |
| `gspot check` | Everything, whole tree, network checks included. |
| `gspot check ts/eslint` | One check. |
| `gspot check --stage pre-commit` | What the hook of that name runs. `pre-push` and `commit-msg` likewise. |
| `gspot check --scope api` | One scope of a monorepo. |
| `gspot check --inspects types` | Every check that looks for one thing. |
| `gspot check --since origin/main` | Only over files changed since a ref. The pull-request form. |
| `gspot check --skip <id>` | Skips one check for this run. Recorded in the run report. `gspot.local.toml` `skip = [...]` is the persistent form for one machine. |
| `gspot check --unchecked` | Prints only the files nothing reads, with the reason each is unread. |
| `gspot fix` | Every fixer in a fixed order, formatters last, then the checks again to prove they converged. `gspot fix <id>` for one. Touches source through each tool's own fixer and the shell header migration. Never a dependency version, never `gspot.toml`, never a generated config, never a rule file, never a baseline, which `gspot generate` writes. |
| `gspot report` | The last run. `--failed` gives each failure with the command that reproduces it alone. `--sarif` and `--json` for machines. |
| `gspot coverage` | Asks every check which files it reads and writes the path table to `.gspot/coverage.json`. `--diff` fails on any regression against the tracked table; that is the hook form. |

Tasks the runner emits (`mise run lint:ts`, `bun run lint:ts`) call `gspot check`
with the matching flags. There is no `gspot run`; the runner you chose is the
task runner.

## Look things up

| Command | Does |
| --- | --- |
| `gspot config` | Every value resolved from `gspot.toml`, with its source: preset default, scope, root, or the file. |
| `gspot config <tool>` | One tool's rendered configuration, with where each value came from. |
| `gspot explain <rule>` | What the rule checks, which preset turns it on, which rule file states it, which settings touch it. `ruff rule` and `biome explain`. Nothing else is explained here: a coverage failure and a banned-term finding each print their own reason on their own line. |

## Change one thing

Every change to policy is a hand edit to `gspot.toml` followed by `gspot generate`.
No command writes to the file. Every table is documented in
[06-settings.md](06-settings.md) with a copy-paste example.

## Hooks

| Command | Does |
| --- | --- |
| `gspot hooks install` | Writes `.gspot/hooks/pre-commit`, `pre-push` and `commit-msg`, each one line calling `gspot check --stage <name>`, and sets `core.hooksPath`. Refuses to overwrite a hook it did not write. `init` does this; this is for after a no at init or an uninstall. |
| `gspot hooks uninstall` | Removes the three files and unsets `core.hooksPath`. |

| Hook | Runs | Over |
| --- | --- | --- |
| `pre-commit` | every check that requires nothing, plus `generate --check` and `coverage --diff` | staged files, and the scopes whose policy changed |
| `pre-push` | everything, including build, Docker and network checks, plus baselines and the full coverage | the whole tree |
| `commit-msg` | commitlint | the message |

Every check runs locally. Slow, build and network checks run at pre-push, never
only in CI. When `[gate] ci` is set, CI runs the same `pre-push` set over the
pushed tree. [09-gates.md](09-gates.md).

## Help, version, completion, mistakes

`gspot --help` lists every command with one line. `gspot <command> --help`
prints the command's flags, each with one line and one example. `gspot
--version` prints `gspot 0.1.0`. commander generates all three from the same
strings the tables on this page use.

`gspot completion bash|zsh|fish` prints the completion script for that shell,
generated from the same command table, so a new flag completes without anyone
editing a script.

An unknown command or flag prints the mistake, the closest match, and how to
get help, then exits 2. The guess is never run.

```text
$ gspot chek
unknown command "chek"
did you mean: check
run gspot --help for the list
```

Versions follow semantic versioning from 0.1.0. The version is written into the
header of every generated file and into `coverage.json`, and `upgrade` compares
that header with the binary.

## Without a terminal

Only `init` asks anything, and only when stdout is a terminal and a question has
no flag. Every other command never prompts. When stdout is not a terminal, or
`CI` or `NO_COLOR` is set, or `--no-color` or `--quiet` is given: no spinners, no
colour, one plain line per item, the same words.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Every check ran and passed |
| 1 | The gate failed: a finding, a coverage gap, a hand-edited generated file, a missing tool, a baseline exceeded. The output says which. |
| 2 | gspot could not run: `gspot.toml` does not load, a preset requirement is missing, an unknown setting, an unknown command, a question with no answer and no terminal |

The same three codes as ruff, eslint and biome. A script needs to know pass,
fail, or broken; the reason is in the output.

## Output

One line per check, grouped by scope, then a summary. Failures print the tool's
own output verbatim, because a wrapper that reformats a compiler error makes it
harder to read. A coverage failure prints the file and the reason it is unread
on one line, so nothing is left to look up.

```text
api          ts/tsc              ok      512 files   4.2s
api          ts/eslint           ok      512 files  21.4s
api          docker/nginx        SKIP    docker daemon unavailable
supabase     sql/sqlfluff        ok       83 files   1.8s
supabase     sql/squawk          ok        3 files   0.3s
ios          swift/swiftlint     FAIL    724 files  12.1s

unchecked    supabase/tests/suites/sql/rls/versioning.test.sql
             ignored by supabase/.sqlfluffignore:9  pattern sql/
             remove the pattern, or declare the path in gspot.toml

coverage     3330 paths   1 unchecked   0 partial   0 orphan
exceptions   7

failed: swift/swiftlint, coverage
reproduce: gspot check swift/swiftlint --scope ios
```

`--quiet` prints failures only. `--verbose` prints every command executed with
its full argument list.

## Packaging

One npm package, `gspot`, one binary. First run is `bunx gspot init` or
`npx gspot init`; a repository on the mise runner pins it as `npm:gspot` and
runs `mise exec -- gspot`. The tools gspot drives are never dependencies of the
gspot package. Under the bun and npm runners they are the consumer's dev
dependencies at the pinned versions; under mise they are pins. gspot writes
nothing outside the repository: the tool cache is `.gspot/bin/`, gitignored
through the managed block, and a deleted clone leaves nothing behind. No home
directory file, no global configuration.

## How it is built

Three libraries, each the settled answer for its job, none bringing a framework.

| Job | Library | Why this one |
| --- | --- | --- |
| Commands, flags, help, completion | **commander** | The dependency behind Vue CLI and Create React App; 220 kB; no scaffolding, no plugin system, because presets are data. oclif's plugin architecture buys nothing here at fifty times the size. |
| The `init` questions | **@clack/prompts** | Text, confirm, select and multiselect with cancellation. What the current scaffolding tools use, a fifth the size of the alternatives. |
| Running many checks with live status | **listr2** | Nested task lists with concurrency; prints verbatim tool output only for failures; falls back to plain lines off a terminal. |

The command modules under `src/commands/` hold argument parsing and output
only; every operation is a plain function in the package that owns it, callable
without a terminal, which is what the tests call. No other terminal library
enters the dependency list.
