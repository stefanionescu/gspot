# Command Line

This document decides every command, flag, output line and exit code. Each is one that `git`,
`cargo`, `ruff`, `biome`, `mise` or `gh` already has, named the way its source names it.

## Commands

```text
gspot init      [--yes] [--presets <ids>] [--without <ids>] [--scope <path=ids>] [--own <tools>] [--no-install]
                [--reconcile]
                [--hooks gspot|lefthook|husky|none] [--ci github|none] [--rules yes|no]
                [--project-templates] [--runner mise|npm|bun|pnpm|uv|none]
gspot check     [<check-id>] [--staged] [--since <ref>] [--fix] [--dry-run] [--watch]
                [--stage commit|push|manual] [--scope <path>] [--skip <check-id>] [--json]
gspot sync      [--check] [--baseline]
gspot rules     [--check] [--project-templates]
gspot ignore    <check-id> [--paths <glob>...] [--rule <rule>] [--reason <text>]
gspot add       <preset>... [--scope <path>]
gspot remove    <preset> [--scope <path>]
gspot allow     <tool> <value>... [--reason <text>]
gspot set       <key> <value> [--reason <text>] [--scope <path>]
gspot declare   <glob>... [--produced-by <command> | --vendored] [--reason <text>]
gspot why       <path>
gspot explain   <check-id> | <tool>/<rule>
gspot doctor    [--json] [--settings]
gspot upgrade   [--check] [--to <version>] [--yes]
gspot uninstall [--keep-hooks]

global: --help  --version  --quiet  --verbose  --no-color  -C <dir>
env:    NO_COLOR  CI  GSPOT_LOG
exit:   0 passed   1 findings   2 gspot did not run
```

Fifteen commands in v1. `completion <shell>` follows in v1.1. Six of them write `gspot.toml`
(`ignore`, `add`, `remove`, `allow`, `set`, `declare`); together they cover every setting the file
has, so nobody has to type TOML to change policy. Hand edits stay valid and are checked on load.

## init

Reads the repository, proposes a policy, writes it after a yes.

### What it reads

1. The tracked file list (`git ls-files`), or a walk that honours `.gitignore` when there is no
   git repository.
2. Manifests: `package.json`, `pyproject.toml`, `requirements*.txt`, `Package.swift`, `*.xcodeproj`,
   `go.mod`, `Cargo.toml`, `Gemfile`, `supabase/config.toml`, `wrangler.*`, `next.config.*`,
   `Dockerfile*`, `docker-compose*`, `nginx.conf`.
3. Workspace declarations: `workspaces` in `package.json`, `pnpm-workspace.yaml`, uv workspaces,
   Cargo workspaces. These define scopes. A stray manifest in a tools folder does not.
4. Existing tool configuration at conventional paths, for the takeover table.
5. Existing hooks (`.husky/`, `lefthook.yml`, `.githooks/`, `core.hooksPath`), CI
   (`.github/workflows/*`), agent files (`CLAUDE.md`, `AGENTS.md`, a rules directory).

### What it prints

```text
reading 3,330 tracked files

languages     typescript 836   swift 724   sql 85   bash 99   markdown 21
frameworks    express        api/package.json
platforms     supabase       supabase/config.toml
scopes        api  supabase  ios          from package.json workspaces
runner        mise                        mise.toml
hooks         .githooks/                  pre-commit, pre-push, commit-msg
ci            none
agent files   CLAUDE.md  AGENTS.md  rules/ (11 files)

already configured   eslint  prettier  typos  markdownlint  commitlint  shellcheck  sqlfluff  swiftlint  gitleaks
no gspot preset      qlty  lychee
```

### The questions

Asked in this order, in a terminal, through `@clack/prompts`. Each has a flag. `--yes` takes
every proposal. With no terminal and no flag for a question, gspot exits 2 and names the flag.

| Question | Proposal | Flag |
| --- | --- | --- |
| Scopes and presets per scope | From detection | `--presets`, `--scope` |
| Own these tools? (one yes or no per tool) | Yes for every tool gspot has a preset for | `--own <tool,...>` or `--yes` |
| Extensions nothing claims: declare or leave | Leave, listed in `doctor` | `--yes` |
| Install git hooks? | Yes when hooks exist; else yes | `--hooks gspot|lefthook|husky|none` |
| Write a CI workflow? | Yes when `.github/` exists with no lint job; else no | `--ci github|none` |
| Install agent rule files? | Yes | `--rules yes|no` |
| Task runner surface | The runner detected; `none` when none | `--runner` |

### The plan

Printed before anything is written:

```text
write
  gspot.toml                      your policy, 48 lines
  .gspot/                         generated configuration, baselines, hooks
  eslint.config.js                stub that imports .gspot/eslint.config.js
  .prettierrc.json                stub
  CLAUDE.md  AGENTS.md            one managed block each
  .gspot/rules/                   14 rule files

delete
  eslint.config.mjs               94 rules carried into gspot.toml
  .prettierrc.json                4 values carried
  ios/.swiftlint.yml              87 rules carried
  .husky/                         replaced by .gspot/hooks/

change
  package.json                    add 12 devDependencies gspot pins; remove 3 scripts gspot replaces
  .mise/conf.d/gspot.toml         9 tool pins, 4 tasks
  .gitignore                      one managed block

baseline
  22 rules enter a baseline with 1,204 findings; every other check passes

Continue? [y/N]
```

A no writes nothing. Git holds everything the yes deletes.

After the yes, `init` runs the runner's install step (`mise install`, or the package manager's
install) so every pinned tool is present before the first `check`. `--no-install` skips it and
prints the command to run. A failed install does not undo the write; `doctor` names what is
missing.

### Takeover

For each owned tool: its configuration is read (through the tool's own print-config where one
exists), every value it carries is written into `gspot.toml` under `[tools.<name>]`, the file is
deleted, and a stub at the conventional path points at the generated file. Where a tool has no
print-config (markdownlint, stylelint, typos, hadolint, sqlfluff), gspot parses the file with the
tool's own loader. An option gspot has no slot for is carried into `[tools.<name>.extra]` with the
reason `carried from <file> at init`, rendered verbatim into the generated config, and listed in
the plan. Nothing is dropped; a key the loader itself rejects is listed as dropped with the
loader's message.

A tool gspot has no preset for is left alone and listed. The person adds it as a `[[check]]`
entry when they want it in the gate.

An existing `CLAUDE.md` or `AGENTS.md` is never read, split or moved. gspot appends one managed
block between markers. An existing rules directory is left alone; gspot's files land in
`.gspot/rules/` unless `[rules] directory` names another empty directory.

### Refusal

`init` refuses to run when `gspot.toml` exists and points at `gspot init --reconcile`.

### Reconcile

`gspot init --reconcile` runs detection again on an installed repository and writes nothing. It
prints what `init` would propose today that the policy does not have: languages and frameworks
that appeared, tool configuration files that appeared at conventional paths and are not taken
over, extensions no preset claims, hooks or CI that changed outside gspot. Each line ends with the
command that applies it (`gspot add nextjs`, `gspot declare "vendor/**" --vendored`, `gspot sync`).
Nothing is applied without that second command, so a re-run can never overwrite a decision.

## check

Runs checks and prints findings.

| Form | Runs |
| --- | --- |
| `gspot check` | Every check in every scope, `commit` and `push` stages. Whole tree. |
| `gspot check --staged` | `commit` stage over staged files. The pre-commit form. |
| `gspot check --since origin/main` | `commit` and `push` stages over files changed since a ref. The pull-request form. |
| `gspot check --stage manual` | The checks that need the network or minutes: CodeQL, external links, container scans. |
| `gspot check typescript/eslint` | One check. |
| `gspot check --scope api` | One scope. |
| `gspot check --fix` | Every fixer in order (codemods, imports, manifests, formatters), then the checks again to prove convergence. |
| `gspot check --fix --dry-run` | Prints the diff of every fix without applying it. Writes nothing. |
| `gspot check --watch` | Re-runs the `commit` stage over files as they change. |
| `gspot check --skip <id>` | Skips one check this run. Printed and recorded. |

Every finding line carries the rule, the message, and a link to the rule's page under
`docs/rules/<check-id>`. `gspot explain <check-id>` prints that page in the terminal: what the
check looks for, which preset turns it on, the rule file statement it enforces, the settings that
change it, and the ignore entry that turns it off.

`gspot explain markdownlint/MD024` does the same for a rule inside a tool: the tool's own summary
of the rule, the check that runs it, and the exact `[tools.markdownlint]` line that changes or
turns it off, with the reason field already in it. The finding line for a tool rule prints this
command, so the path from "what is MD024" to "how do I change it" is one command and never a
trip to the tool's website.

Results are cached in `.gspot/cache/` keyed on the tool version, the generated configuration
hash and the content hash of every file the check read. A check whose inputs are unchanged
prints `cache` instead of `ok` and does not run. The cache never decides a verdict: a cached
result is a recorded verdict from a real run.

A check whose file set is empty does not run and does not print. A check whose tool is missing
prints `MISSING` and fails with the install hint from `doctor`.

### Output

```text
api        typescript/tsc            ok       512 files   4.2s
api        typescript/eslint         FAIL     512 files  21.4s
  src/routes/turn.ts:41:3  gspot/no-call-through  This function passes its arguments straight through to buildTurn.
  src/routes/turn.ts:88:1  max-lines-per-function  Function has 71 lines (limit 60).
  reproduce: gspot check typescript/eslint --scope api
api        docker/hadolint           ok         1 file    0.3s
supabase   sql/sqlfluff              ok        83 files   1.8s
ios        swift/swiftlint           MISSING  swiftlint 0.63.2 is not installed. Run: mise install

baselines  typescript/eslint:vitest/expect-expect  97 of 100
ignores    3 (printed with --verbose)
unchecked  4 files (gspot doctor)

failed: typescript/eslint, swift/swiftlint
```

Rules: one line per check that ran over at least one file; findings under the check, verbatim
from the tool, file first; a reproduce line per failing check; baselines that hold print their
count; the summary names every failing check. `--quiet` prints failures only. `--verbose` prints
every command with its arguments and every ignore with its reason. `--json` prints the run record
instead. `.gspot/last.json` is always written.

Columns are computed from the longest check id, not fixed.

## sync

Re-renders every generated file from `gspot.toml`. Idempotent. Run after any edit.

- Writes `.gspot/<tool>.<ext>` for every owned tool, stubs at conventional paths, hooks, the
  runner surface, the CI workflow when enabled, and the agent files when enabled.
- `--check` renders in memory and compares bytes. A difference fails with a diff and two ways
  forward: move the change into `gspot.toml`, or run `sync` to discard it. `check` runs this
  assertion at the `commit` stage.
- `--baseline` rewrites every baseline from `.gspot/last.json`. Counts fall; a count that rose
  fails.
- Never writes `gspot.toml`.

## rules

Installs or refreshes the agent rule files for the selected presets, and the managed block in
`CLAUDE.md` and `AGENTS.md`. `--check` reports drift and the unenforced statement count.
`sync` calls this when `[rules] install = true`.

## ignore

`gspot ignore <check-id> --paths "scripts/**" --reason "One launcher script per environment."`
appends an `[[ignore]]` entry to `gspot.toml`, validates the file, and prints the entry. The
reason is required and refused when it says nothing. `--rule` narrows to one rule inside the
check.

Inline suppressions for gspot's own engines use one syntax per comment style:

```text
// gspot-ignore structure/call-through -- The public name is the stable one.
# gspot-ignore naming/identifiers -- Platform API name.
```

A suppression without a reason is a finding. Every form is counted in the suppression census.

## add, remove

`gspot add nextjs vitest` appends presets to the root selection (`--scope api` to a scope's),
validates the file, runs `sync`, and prints the plan `init` would have printed for them: tools
added, files written, baselines created. `gspot remove vitest` does the reverse, including the
files `sync` no longer renders.

## allow

`gspot allow typos udid --reason "Apple API name"` appends to the allow list a tool exposes:
`typos` words, `typos-exclude` paths, `licenses` exceptions (`name@version` with `--license`),
`naming` allowed names, `naming-external` names, `gitleaks` allow entries, `osv` ignored advisory
ids. The reason is required for every list except `typos` words, where the word itself is the
reason and `--reason` is optional. The entry prints back, `sync` runs, and the next `check` shows
the finding gone.

## set

`gspot set limits.function_lines 80 --reason "Route tables are one ordered list each."` writes one
scalar or list setting: any `[limits]` key, any tool slot, any `[architecture]`, `[structure]`,
`[naming]`, `[rules]`, `[hooks]`, `[ci]`, `[editor]`, `[coverage]` or `[runner]` key. The key is
the dotted path `doctor --settings` prints. A loosening (raising a limit, turning a rule or a
tool off) requires the reason; a tightening does not. `--scope` targets a scope table. An unknown
key fails with the keys that exist under that table.

## declare

`gspot declare "api/types/supabase.ts" --produced-by "supabase gen types"` and
`gspot declare "vendor/**" --vendored --reason "Upstream source, patched only by rebase."` append
`[[declare]]` entries, so file natures never need hand-written TOML either.

## Writing `gspot.toml`

The six writing commands share one writer. It parses the file with its comments and order intact,
appends or replaces the one entry, validates the whole file exactly as load does, writes it, runs
`sync`, and prints the lines it wrote. A refused reason (`N/A`, `TBD`, empty) or an unknown key
fails before anything is written. A hand edit produces the same file; the commands exist so that
the common edits are one line at the terminal instead of a table someone has to look up.

## why

`gspot why api/src/routes/turn.ts` prints the presets that claim the file, the checks that run
on it at each stage with the rule set each applies, the baselines it is in, and the ignores that
touch it. For an unchecked file it prints the reason (no preset claims the extension, a
declaration excludes it, the nature is binary) and the one line that would change it.

## doctor

Prints what a person cannot see from a run:

```text
tools
  ok        eslint 9.38.0            node_modules/.bin/eslint
  ok        shellcheck 0.11.0        /opt/homebrew/bin/shellcheck
  missing   swiftlint 0.63.2         mise install
  outdated  typos 1.40.0 (want 1.43.5)   mise install

unchecked files          12
  .editorconfig .nvmrc LICENSE ...   no preset claims them (add [[declare]] or a preset)
  assets/hero.wav                    binary: secrets scan only

detected, not selected
  nextjs                             next in package.json        gspot add nextjs
  vitest                             vitest in package.json      gspot add vitest

hooks      .gspot/hooks  installed
ci         none
rules      14 files, 3 statements unenforced
gspot      0.4.0 (0.5.0 available)
```

Exit 0 unless a tool is missing or outdated. Coverage is information here. `[coverage] strict =
true` in `gspot.toml` turns unchecked files into a failing check.

`gspot doctor --settings` prints every setting the selection exposes, its current value, and
where the value came from (preset default, scope table, root table).

## upgrade

`gspot upgrade --check` prints what the newer version changes and writes nothing: rules added,
removed, stricter; tools bumped; rule files changed; presets now available that the repository
does not select; coverage change; `extra` keys that now have a slot; project templates that
changed upstream since they were copied (read from the `gspot-template` header line), which the
person merges by hand or ignores.

`gspot upgrade` prints the same report as its plan, then asks, exactly as `init` does. `--yes`
skips the question. On a yes it moves the version pin, re-renders every generated file, rewrites
the managed blocks between their markers, writes baselines for rules that arrive with findings,
and reports. It never writes `gspot.toml`, never touches text outside a managed block, never
touches the project rule layer, and never commits. Because every decision lives in `gspot.toml`,
an upgrade cannot lose a setting; what it changes is visible in the tracked diff of `.gspot/`.
`--to` moves to an exact version, downward included.

## uninstall

Removes what `init` wrote: `.gspot/`, the stubs, the managed blocks, the runner surface, the
workflow, and `core.hooksPath`. Leaves `gspot.toml` and the project rule layer. Restores nothing.

## Global behaviour

- Without a terminal, or with `CI`, `NO_COLOR` or `--no-color`: no colour, no spinners, the same
  words.
- An unknown command or flag prints the mistake, the closest match, and `run gspot --help`,
  then exits 2. commander's suggestion feature provides the match.
- `-C <dir>` runs as if started in that directory.
- Every command resolves the repository root from the current directory and works from it.
- gspot runs natively on macOS, Linux and Windows. Paths print with the platform separator and
  compare through `node:path`. Hooks on Windows run under the `sh` that Git for Windows ships.
  A check that needs a tool with no Windows build (`plutil`, `xcodebuild`, `swiftlint`) is a
  platform skip there and passes. Install hints name the platform's manager: mise, Homebrew,
  apt, winget, scoop.
- gspot sends nothing anywhere. There is no telemetry, no update check inside `check`, and no
  network access outside `upgrade`, `doctor` (one version lookup, when a person runs it) and
  checks that declare `network`.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Every check ran and passed, or the command completed |
| 1 | Findings, a baseline exceeded, a generated file drifted, a tool missing |
| 2 | gspot did not run: bad `gspot.toml`, unknown preset, unknown command, unanswered question |
