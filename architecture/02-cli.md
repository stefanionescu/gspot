# Command Line

This document decides every command, flag, output line, and exit code. Each is one that `git`,
`cargo`, `ruff`, `biome`, `mise` or `gh` already has, named the way its source names it.

## Commands

```text
gspot init      [--yes] [--from <profile>] [--presets <ids>|none] [--without <ids>] [--scope <path=ids>]
                [--own <tools>] [--no-install] [--allow-dirty]
                [--hooks gspot|lefthook|husky|none] [--ci github|none] [--no-rules] [--keep-format | --shipped-format]
                [--project-templates] [--runner mise|npm|bun|pnpm|uv|none]
gspot check     [<check-id>] [--staged] [--since <ref>] [--fix] [--dry-run]
                [--at commit|push|manual|message] [--scope <path>] [--skip <check-id>]
gspot apply      [--check] [--lower-baselines] [--baseline <check>] [--project-templates]
gspot ignore    <check-id> [--paths <glob>...] [--rule <rule>] [--reason <text>] [--remove]
gspot add       <preset>... [--scope <path>]
gspot remove    <preset> [--scope <path>]
gspot allow     <tool> <value>... [--reason <text>] [--remove]
gspot set       <key> [<value>...] [--reason <text>] [--scope <path>] [--replace | --remove | --default]
gspot declare   <glob>... [--produced-by <command> | --vendored] [--reason <text>] [--remove]
gspot why       <path>
gspot explain   <check-id> | <tool>/<rule> | <preset> | <setting-key>
gspot doctor    [--settings]
gspot upgrade   [--check] [--to <version>] [--yes] [--no-install]
gspot uninstall [--keep-hooks]
gspot profile   save <file> | check <profile>
gspot completion <bash|zsh|fish|powershell>

global: --help  --version  --json  --quiet  --verbose  --no-color  -C <dir>
env:    NO_COLOR  CI  GSPOT_BIN  GSPOT_JOBS
exit:   0 passed   1 findings   2 gspot did not run
```

Sixteen commands in v1 (D-79). `check --watch` follows in v1.1. Six of them write `gspot.toml`
(`ignore`, `add`, `remove`, `allow`, `set`, `declare`); together they cover every setting the
file has, so nobody has to type TOML to change policy. Hand edits stay valid and are checked on
load. `completion` prints the shell script `@bomb.sh/tab` generates from the command tree, so
every command and flag completes in bash, zsh, fish, and PowerShell.

## Conventions

The checklist is [clig.dev](https://clig.dev/). What it means here:

- Output goes to stdout; messages about the run (progress, warnings, hints) go to stderr, so
  `gspot check --json > out.json` holds only the record.
- `-h` and `--help` on every command; `--help` lists every flag with one plain sentence each.
  `--version` prints the version and nothing else.
- No color, no spinner, and no question without a terminal. A question that has no flag and no
  terminal is exit 2, naming the flag.
- A mistyped command or flag prints the closest match. A command that deletes (`uninstall`,
  `init` over existing configuration, `remove`) prints its plan and asks; `--yes` answers.
- Every command that writes takes `--dry-run`, which prints the writes and makes none.
- Every finding ends with a `help:` line, the way Ruff prints one, taken from the check's `fix`.
- Flags mean the same thing everywhere: `--scope`, `--reason`, `--json`, `--yes`, `--remove`.

What the CLI is for, and what stays a hand edit. The commands add, change, or remove one entry at a time, because that is the edit a person makes when a finding appears. A bulk change (ten
banned terms, a new architecture matrix) is a hand edit of `gspot.toml` followed by `gspot
apply`. Both produce the same file, validated the same way.

## `init`

Reads the repository, proposes a policy, writes it after a yes.

### What it reads

1. The files git tracks or is about to track (`git ls-files --cached --others --exclude-standard`),
   so a file created and not yet staged is checked too. Without a git repository, a walk that honors `.gitignore`.
2. Manifests: `package.json`, `pyproject.toml`, `requirements*.txt`, `Package.swift`, `*.xcodeproj`,
   `go.mod`, `Cargo.toml`, `Gemfile`, `supabase/config.toml`, `wrangler.*`, `next.config.*`,
   `Dockerfile*`, `docker-compose*`, `nginx.conf`.
3. Workspace declarations: `workspaces` in `package.json`, `pnpm-workspace.yaml`, Lerna, and Rush
   (through `@manypkg/get-packages`), uv workspaces, Cargo workspaces. These define scopes. A
   stray manifest in a tools folder does not.
4. Existing tool configuration at conventional paths, for the takeover table.
5. Existing hooks (`.husky/`, `lefthook.yml`, `.githooks/`, `core.hooksPath`), CI
   (`.github/workflows/*`), agent files (`CLAUDE.md`, `AGENTS.md`, a rules directory), and
   folders that look like home-grown lint tooling (`quality/`, `lint/`, `.qlty/`, a workspace
   package whose dependencies are all linters).

### What it prints

```text
reading 3,330 tracked files

languages     typescript 836   swift 724   sql 85   bash 99   markdown 21
frameworks    express        api/package.json
platforms     supabase       supabase/config.toml
scopes        api  supabase  ios          from package.json workspaces
runner        mise                        mise.toml
hooks         .githooks/                  pre-commit, pre-push, commit-msg (hand-written)
ci            none
agent files   CLAUDE.md  AGENTS.md  rules/ (11 files)
lint tooling  quality/  .qlty/            yours; gspot leaves them alone

already configured   eslint  prettier  typos  markdownlint  commitlint  shellcheck  sqlfluff  swiftlint  gitleaks
no gspot preset      qlty  lychee
```

### The questions

Asked in this order, in a terminal, through `@clack/prompts`. Each has a flag. `--yes` takes
every proposal. With no terminal and no flag for a question, gspot exits 2, and names the flag.

| Question                                                                                                 | Proposal                                                                  | Flag                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------- | -------- | ----- | ----- |
| Scopes and presets per scope                                                                             | From detection                                                            | `--presets`, `--scope`              |
| Own these tools? (one yes or no per tool)                                                                | Yes for every tool gspot has a preset for                                 | `--own <tool,...>` or `--yes`       |
| Extensions nothing claims: declare or leave                                                              | Leave, listed in `doctor`                                                 | `--yes`                             |
| Install git hooks?                                                                                       | Yes when hooks exist; else yes                                            | `--hooks gspot                      | lefthook | husky | none` |
| Write a CI workflow?                                                                                     | Yes when `.github/` exists with no lint job; else no                      | `--ci github                        | none`    |
| Install agent rule files?                                                                                | Yes                                                                       | `--no-rules`                        |
| Task runner surface                                                                                      | The runner detected; `none` when none                                     | `--runner`                          |
| Keep your formatting? (asked only when an existing formatter config differs from the shipped `[format]`) | Keep: your indent and width go into `[format]` and nothing is reformatted | `--keep-format`, `--shipped-format` |

### The plan

Printed before anything is written:

```text
write
  gspot.toml                      your policy, 48 lines
  .gspot/                         generated configuration, baselines, hooks, version pin
  eslint.config.js                stub that imports .gspot/eslint.config.js
  .prettierrc.json                stub
  CLAUDE.md  AGENTS.md            one managed block each
  .gspot/rules/                   14 rule files

delete (git keeps them: git show HEAD:<path>)
  eslint.config.mjs               replaced by gspot's config; 3 disabled rules carried as ignores
  .prettierrc.json                replaced
  ios/.swiftlint.yml              replaced; 2 disabled rules carried as ignores
  .husky/                         replaced by .gspot/hooks/

carried into gspot.toml
  typos.toml                      14 words
  .gitleaks.toml                  6 allowlist entries
  .license-checker.json           2 exceptions

change
  package.json                    add 12 devDependencies gspot pins; remove 3 scripts gspot replaces
  .config/mise/conf.d/gspot.toml         9 tool pins, 4 tasks, gspot 0.5.0
  .gitignore                      one managed block

no longer runs; delete when ready
  .githooks/                      core.hooksPath now points at .gspot/hooks
  quality/                        a folder of lint scripts; nothing in the gate calls it
  ios/package.json                a manifest whose dependencies are all tools gspot now pins
  mise.toml                       15 pins gspot also pins (gspot doctor lists them)

baseline
  22 rules enter a baseline with 1,204 findings; every other check passes

Continue? [y/N]
```

A no writes nothing. Git holds everything the yes deletes.

After the yes, `init` runs the runner's install step (`mise install`, or the package manager's
install) so every pinned tool is present before the first `check`. `--no-install` skips it and
prints the command to run. A failed install does not undo the write; `doctor` names what is
missing. The last line of `init` names a newer gspot when one exists.

### Takeover

gspot replaces; it does not merge. For each owned tool, the existing configuration file is
deleted (git keeps it) and the generated file and stub take its place. The plan lists every
deleted file with the `git show` command that prints it.

Carried into `gspot.toml`, because they are facts about the repository and not policy:

| From                                                                                                                                                                                                                                   | Into                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| typos words and excludes                                                                                                                                                                                                               | `[tools.typos] words`, `exclude`, reason `carried at init`              |
| typos locale                                                                                                                                                                                                                           | `[tools.typos] locale`; a file with none carries `en`                   |
| gitleaks allowlist entries and baseline fingerprints                                                                                                                                                                                   | `[tools.gitleaks] allow`, `baseline_reasons`                            |
| osv-scanner ignored advisories                                                                                                                                                                                                         | `[tools.osv] ignore`                                                    |
| license exceptions                                                                                                                                                                                                                     | `[[tools.licenses.exceptions]]`                                         |
| a rule turned off in a linter config (ESLint `off`, Ruff `ignore` and `per-file-ignores`, SwiftLint `disabled_rules`, ShellCheck `disable`, sqlfluff `exclude_rules`, squawk `excluded_rules`, markdownlint `false`, stylelint `null`) | one `[[ignore]]` per rule with the reason `carried from <file> at init` |

That is the whole carry list: exception lists and allowlists, which are facts about the
repository. Everything else in an old file (entry points, schemes, contracts, ignore patterns,
limits) is policy. The person reads it with `git show` and re-declares what they still want through `set`, `declare` or a hand edit. One loader per list above, none per tool.

Every carried reason says `carried from <file> at init`, prints on every run like any other
ignore, and is the person's to rewrite or remove. Nothing else is read from the old file. A limit, a plugin list or a style option in it is the old policy, and the generated one is the new policy.

A tool gspot has no preset for is left alone and listed. The person adds it as a `[[check]]`
entry when they want it in the gate.

Hand-written hooks are never deleted. When `.githooks/` or another hook directory holds scripts
gspot did not write, `init` points `core.hooksPath` at `.gspot/hooks` and lists the old directory
under `no longer runs; delete when ready`.

Three other things land on that list, each by one rule that reads no code:

- a directory nothing in the gate references (`quality/`, `lint/`, `.qlty/`);
- a package manifest whose dependencies are all tools gspot now pins (with its lockfile);
- a `mise.toml` or `devDependencies` pin gspot also pins.

Task-runner tasks, agent rule directories and documentation are the person's; gspot lints them and never judges them. Takeover reads conventional paths only. gspot touches nothing it did not write; the person deletes with the list in hand (D-57). [17-migration.md](17-migration.md) shows the list for a real repository.

An existing `CLAUDE.md` or `AGENTS.md` is never read, split, or moved. gspot appends one managed
block between markers. An existing rules directory is left alone; the rule files land in
`.gspot/rules/` unless `[rules] directory` names another empty directory.

### Refusal

`init` refuses to run when `gspot.toml` exists and points at `gspot doctor`, which prints what
has changed in the repository after the install and the command that applies each change.

`init` also refuses, with exit 2 and nothing written, in these cases:

- A choice flag holds a value outside its list (`--hooks`, `--ci`, `--runner`, `--no-rules`,
  `--at`). The message names the flag and the allowed values. `check --at` follows the
  same rule.
- `--presets` or `--without` names a preset that does not exist. The message names the near
  matches.
- `--without` names a preset that a selected preset requires. The message prints the chain, such
  as `typescript requires javascript`.
- The working tree has uncommitted changes and `--allow-dirty` is absent. The migration is one
  diff, and git is the only rollback `init` has.
- `--from` names a profile that does not load or does not validate.

### Order of writes

`init` writes before it deletes (D-83). The order is fixed:

1. Validate every flag, the profile and the proposed `gspot.toml` in memory.
2. Write `gspot.toml`, `.gspot/` and the stubs.
3. Run the install step and the first check.
4. Delete the files takeover replaces.

A failure in step 2 or 3 leaves every old configuration file in place, and the message says so.

### The selection question

The first question lists every detected preset, selected, and every other shipped preset,
unselected, in one multiple-choice prompt. A preset that another selected preset requires shows
as locked, with the preset that requires it. A recommended preset shows as selected and can be
cleared. `--yes`, `--presets` and `--from` skip the question. The plan that follows names every
selected preset, how it was selected (detected, required, recommended, named), and its number of
checks.

## `check`

Runs checks and prints findings.

| Form                              | Runs                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `gspot check`                     | Every check in every scope, `commit` and `push` stages. Whole tree.                                          |
| `gspot check --staged`            | `commit` stage over staged files. The pre-commit form.                                                       |
| `gspot check --since origin/main` | `commit` and `push` stages over files changed since a ref. The pull-request form.                            |
| `gspot check --at manual`         | The checks that need the network or minutes: CodeQL, external links, container scans.                        |
| `gspot check typescript/eslint`   | One check.                                                                                                   |
| `gspot check --scope api`         | One scope.                                                                                                   |
| `gspot check --fix`               | Every fixer in order (codemods, imports, manifests, formatters), then the checks again to prove convergence. |
| `gspot check --fix --dry-run`     | Prints the diff of every fix without applying it. Writes nothing.                                            |
| `gspot check --skip <id>`         | Skips one check this run. Printed and recorded.                                                              |

Every finding line carries the rule, the message, and a link to the rule's page under
`docs/rules/<check-id>`. `gspot explain <check-id>` prints that page in the terminal. It shows the check's `summary`, `why` and `fix` from its manifest, which preset turns it on, and the rule file statement it enforces. It also shows the settings that change it and the ignore entry that turns it off.

`gspot explain markdownlint/MD024` does the same for a rule inside a tool. It prints the tool's own summary of the rule where the tool exposes one (`ruff rule`, ESLint rule metadata, `swiftlint rules`, the markdownlint rule table). Otherwise, it prints a link to the tool's page.

Then come the check that runs it, the `gspot ignore` line that turns it off, and the `gspot set` line that changes its options. Each carries the reason field already. The finding line for a tool rule prints this command. The path from the question "what is MD024" to the change is one command and never a trip to the tool's website.

Results are cached in `.gspot/cache/` keyed on the tool version, the generated configuration
hash and the content hash of every file the check read. A check whose inputs are unchanged
prints `cache` instead of `ok` and does not run. The cache never decides a verdict: a cached
result is a recorded verdict from a real run.

A check whose file set is empty does not run and does not print. A check whose tool is missing
prints `missing` and fails with the install hint from `doctor`. Status words are lowercase: `ok`,
`cache`, `fail`, `missing`, `error`, `skip`.

### Output

```text
api        typescript/tsc            ok       512 files   4.2s
api        typescript/eslint         fail     512 files  21.4s
  src/routes/turn.ts:41:3  gspot/no-call-through  This function passes its arguments straight through to buildTurn.
    help: Call buildTurn directly and delete this function, or give it real work.
  src/routes/turn.ts:88:1  max-lines-per-function  Function has 71 lines (limit 60).
    help: Split the function, or raise the limit with a reason: gspot set limits.function_lines 80 --reason "..."
  reproduce: gspot check typescript/eslint --scope api
api        docker/hadolint           ok         1 file    0.3s
supabase   sql/sqlfluff              ok        83 files   1.8s
ios        swift/swiftlint           missing  swiftlint 0.63.2 is not installed. Run: mise install

baselines  typescript/eslint:vitest/expect-expect  97 of 100
ignores    3 (printed with --verbose)
unchecked  4 files (gspot doctor)

failed: typescript/eslint, swift/swiftlint
```

Rules: one line per check that ran over at least one file. Findings sit under the check, verbatim from the tool, file first. A reproduce line follows each failing check. Baselines that hold print their count. The summary names every failing check.

`--quiet` prints failures only. `--verbose` prints
every command with its arguments and every ignore with its reason. `--json` prints the run record
instead. `.gspot/last.json` is always written.

Columns are computed from the longest check id, not fixed.

## `apply`

Re-renders every generated file from `gspot.toml`. Idempotent. Run after any edit.

- Writes `.gspot/<tool>.<ext>` for every owned tool, stubs at conventional paths, hooks, the runner surface, and the CI workflow when enabled. When `[rules] install = true`, it also writes the agent rule files under `[rules] directory` and the managed block in `CLAUDE.md` and `AGENTS.md` ([09-rules.md](09-rules.md) has the assembly).
- `--check` renders in memory and compares bytes for the configuration and the rule files. A difference fails with a diff and two ways forward: move the change into `gspot.toml`, or run `apply` to discard it.
- `--check` also prints the count of rule statements no check enforces. `check` runs this assertion at the `commit` stage.
- `--lower-baselines` rewrites every baseline from `.gspot/last.json`. Counts fall; a count that rose
  fails.
- `--baseline <check>` runs one check and writes a baseline for each of its rules that has findings
  and none yet. It serves a check that starts to work after `init`.
- `--baseline` never raises a baseline, refuses a run that broke, and refuses findings a fixer clears.
- `--project-templates` copies the project templates that match the selection into the project
  rule layer, once each; a template that already exists there is never rewritten.
- Never writes `gspot.toml`.

## `ignore`

`gspot ignore <check-id> --paths "scripts/**" --reason "One launcher script per environment."`
appends an `[[ignore]]` entry to `gspot.toml`, validates the file, and prints the entry. The
reason is required and refused when it says nothing. `--rule` narrows to one rule inside the
check. Without `--paths` the entry applies to the whole scope, which is how a rule is turned off:
`gspot ignore typescript/eslint --rule unicorn/prefer-ternary --reason "..."`. This is the one
way to turn a rule off; a tool slot refuses `off` and prints this line instead. `--remove`
deletes the entry that matches the same check, rule, and paths.

Inline suppressions for the gspot engines use one syntax per comment style:

```text
// gspot-ignore structure/call-through -- The public name is the stable one.
# gspot-ignore naming/identifiers -- Platform API name.
```

A suppression without a reason is a finding. Every form is counted in the suppression census.

## `add`, `remove`

`gspot add nextjs vitest` appends presets to the root selection (`--scope api` to a scope's),
validates the file, runs `apply`, and prints the plan `init` prints for them: tools
added, files written, baselines created. `gspot remove vitest` does the reverse, including the files `apply` stops rendering.

## `allow`

`gspot allow typos udid --reason "Apple API name"` appends to the allow list a tool exposes:
`typos` words, `typos-exclude` paths, `licenses` exceptions (`name@version` with `--license`),
`naming` allowed names, `naming-external` names, `gitleaks` allow entries, `osv` ignored advisory
ids. The reason is required for every list except `typos` words, where the word itself is the
reason and `--reason` is optional. The entry prints back, `apply` runs, and the next `check` shows
the finding gone. `--remove` deletes the matching entry.

## `set`

`gspot set limits.function_lines 80 --reason "Route tables are one ordered list each."` writes one
setting: any `[limits]` key, root or per language (`limits.python.file_lines`), any tool slot,
any `[architecture]`, `[structure]`, `[naming]` (including the per-language ceilings
`naming.python.max_words`), `[rules]`, `[hooks]`, `[ci]`, `[editor]`, `[inspection]` or `[runner]`
key. The key is the dotted path `doctor --settings` prints. A loosening (raising a limit, turning
a tool off, removing a group) requires the reason; a tightening does not. `--scope` targets a
scope table. An unknown key fails with the keys that exist under that table.

For a list-valued key the values are appended: `gspot set naming.banned_terms dispatcher
orchestrator` adds two terms. `--replace` replaces the whole list, `--remove` removes the named
values, and `--default` deletes the key so the shipped default applies again. A tool rule slot
(`tools.eslint.rules.<rule>`) takes the rule's options or `error`; `off` is refused with the
`gspot ignore` line that does it.

## `declare`

`gspot declare "api/types/supabase.ts" --produced-by "supabase gen types"` and
`gspot declare "vendor/**" --vendored --reason "Upstream source, patched only by rebase."` append
`[[declare]]` entries, so file natures never need hand-written TOML either. `--remove` deletes
the entry with the same paths.

## Writing `gspot.toml`

The six writing commands share one writer. It parses the file with its comments and order intact. It appends, replaces or removes the one entry, validates the whole file exactly as load does, writes
it, runs `apply`, and prints the lines it wrote. A refused reason (`N/A`, `TBD`, empty) or an
unknown key fails before anything is written. A hand edit produces the same file; the commands
exist so that the common edits are one line at the terminal instead of a table someone has to
look up.

## `why`

`gspot why api/src/routes/turn.ts` prints the presets that claim the file and the checks that run on it at each stage, with the rule set each applies. It also prints the runtime and file class the ESLint config gives it, the baselines it is in, and the ignores that touch it. For an unchecked file it prints
the reason (no preset claims the extension, a declaration excludes it, the nature is binary) and
the one line that changes it.

## `explain`

One verb for "what is this." It takes:

| Argument                                | Prints                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a check id (`structure/call-through`)   | `summary`, `why` and `fix` from the manifest; the preset that turns it on; the rule file statement it enforces; the settings that change it; the `ignore` line that turns it off                                                                                                               |
| a tool rule (`markdownlint/MD024`)      | the tool's own summary, read from the tool (`ruff rule <code> --output-format json`, `swiftlint rules <id>`, an ESLint rule's `meta.docs`, markdownlint's rule metadata, ShellCheck's wiki page id) or its page; the check that runs it; the `ignore` line for off; the `set` line for options |
| a preset id (`python`)                  | what it detects and claims, the tools it pins, the checks it runs by stage, the settings it exposes, the rule files it installs                                                                                                                                                                |
| a setting key (`limits.function_lines`) | meaning, default, direction, current value and where it came from, the `set` line that changes it                                                                                                                                                                                              |

Every text `explain` prints is written for a person who does not code: what the thing looks
for, what goes wrong without it, what to do. The same text is the page under `docs/`.

## `doctor`

Prints what a person cannot see from a run, and what has changed in the repository after `init` that the policy does not reflect. Each line that has a remedy ends with the command.

```text
tools
  ok        eslint 9.38.0            node_modules/.bin/eslint
  ok        shellcheck 0.11.0        /opt/homebrew/bin/shellcheck
  missing   swiftlint 0.63.2         mise install
  outdated  typos 1.40.0 (want 1.43.5)   mise install

unchecked files          12
  .editorconfig .nvmrc LICENSE ...   no preset claims them (gspot declare, or gspot add <preset>)
  assets/hero.wav                    binary: secrets scan only

detected, not selected
  nextjs                             next in package.json        gspot add nextjs
  vitest                             vitest in package.json      gspot add vitest

configuration not owned
  .stylelintrc.json                  appeared after init          gspot add css
  ios/.swiftlint.yml                 beside .gspot/swiftlint.yml  delete it, or gspot set tools.swiftlint.enabled false --reason

changed outside gspot
  .husky/pre-commit                  hook added by hand           gspot apply
  .github/workflows/lint.yml         a second lint job            none; informational

pinned twice
  swiftlint 0.63.2                   mise.toml and .config/mise/conf.d/gspot.toml   delete the mise.toml line
  eslint 9.38.0                      api/package.json and the root            delete the api entry

hooks      .gspot/hooks  installed
ci         none
rules      14 files
gspot      0.4.0 pinned and running (0.5.0 available: gspot upgrade --check)
```

Exit 0 unless a tool is missing or outdated. Coverage is information here. `[inspection] strict =
true` in `gspot.toml` turns unchecked files into a failing check. Nothing `doctor` prints is
applied; every remedy is a second command, so running `doctor` can never overwrite a decision.

`gspot doctor --settings` prints every setting the selection exposes, its current value, and where the value came from (preset default, scope table, root table). The list includes the per-language limits and naming ceilings, and every `extra` table under "not a slot."

`doctor` is the one command besides `upgrade` that reaches the network: one lookup for a newer
gspot, only when a person runs it.

## `upgrade`

`gspot upgrade --check` prints what the newer version changes and writes nothing. It lists rules added, removed or stricter; tools bumped; rule files changed; presets now available that the repository does not select; coverage change; and `extra` keys that now have a slot. It also lists project templates that changed upstream after they were copied (read from the `gspot-template` header line), which the person merges by hand or ignores.

`gspot upgrade` prints the same report as its plan, then asks, exactly as `init` does. `--yes`
skips the question. On a yes it moves the version pin (`.gspot/version` and the runner surface), re-renders every generated file, and rewrites the managed blocks between their markers. It writes baselines for rules that arrive with findings, runs the runner's install step so the bumped tools are present (`--no-install` skips it and prints the command), and reports.

It never writes
`gspot.toml`, never touches text outside a managed block, never touches the project rule layer,
and never commits. Because every decision lives in `gspot.toml`, an upgrade cannot lose a setting;
what it changes is visible in the tracked diff of `.gspot/`. `--to` moves to an exact version,
downward included.

## `uninstall`

Removes what `init` wrote: `.gspot/`, the stubs, the managed blocks, the runner surface, the
workflow, and `core.hooksPath`. The runner surface includes the devDependencies and the scripts
gspot added to `package.json`, the lines it added under `.husky/`, and its commands in
`lefthook.yml`. Leaves `gspot.toml` and the project rule layer. Restores nothing.

## `profile`

A profile is a policy a person carries between repositories (D-79). The file format is in
[03-configuration.md](03-configuration.md).

`gspot profile save <file>` writes a profile from the policy of this repository. It keeps the
presets, `[limits]`, `[naming]` lists, `[format]`, `[prose]`, `[tools]` settings, `[hooks]`,
`[ci]`, `[rules]` and `[runner]`. It leaves out `[[scope]]`, `[[ignore]]`, `[[declare]]`,
`[[check]]` and every entry that names a path, and it prints each entry it left out.

`gspot profile check <profile>` loads and validates a profile and prints every problem in one
pass. It writes nothing and needs no repository.

`gspot init --from <profile>` takes a path, an `https` URL, or `github:owner/repo[/path][@ref]`.
A remote profile is fetched once, and its SHA-256 is printed in the plan. `init` validates the
profile exactly as `profile check` does before it reads the repository. Flags given beside
`--from` win over the profile.

```text
$ gspot init --from github:alex-garcia/house-style
profile    house-style  sha256 9f2c...  selection exact
presets    typescript (named)  javascript (required)  formatting (named)  spelling (named)
skipped    naming, structure  (recommended by typescript, not in the profile)
detected   bash 3 files  (not in the profile; add it with gspot add bash)
```

## Global behavior

- Without a terminal, or with `CI`, `NO_COLOR` or `--no-color`: no color, no spinners, the same
  words.
- `--json` works on every command that prints a report: `check` and `doctor` print their run
  record; `why`, `explain`, `doctor --settings`, and the `init` and `upgrade` plans print one
  documented object each. The shapes are part of the documented interface, so an agent drives
  gspot without parsing columns. With `--json` and `--yes`, `init` and `upgrade` run without a
  terminal.
- An unknown command or flag prints the mistake, the closest match, and `run gspot --help`,
  then exits 2. commander's suggestion feature provides the match.
- `-C <dir>` runs as if started in that directory.
- Every command resolves the repository root from the current directory and works from it.
- The repository pins a gspot version in `.gspot/version`. A binary of another version exits 2 on `check`, `apply` and the six writing commands, naming the pinned version. The two ways forward: install it (`mise install`, or the package manager's install) or move the pin (`gspot upgrade --to <this version>`).
- `init`, `doctor`, `explain`, `why`, `--version` and `--help` run under any version. [11-toolchain.md](11-toolchain.md) has the install paths.
- gspot runs natively on macOS, Linux, and Windows. Paths print with the platform separator and compare through `node:path`. Hooks on Windows run under the `sh` that Git for Windows ships.
- A check that needs a tool with no Windows build (`plutil`, `xcodebuild`, `swiftlint`) is a platform skip there and passes. Install hints name the platform's manager: mise, Homebrew, apt, winget, scoop.
- gspot sends nothing anywhere. It has no telemetry, no update check inside `check`, and no
  network access outside `upgrade`, `doctor` (one version lookup, when a person runs it),
  the last line of `init`, and checks that declare `network`.
- Every message gspot prints is written for someone who does not code. It says what happened
  and what to do next, in plain words, and names the command that does it.

## Exit codes

| Code | Meaning                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 0    | Every check ran and passed, or the command completed                                                            |
| 1    | Findings, a baseline exceeded, a generated file drifted, a tool missing                                         |
| 2    | gspot did not run: bad `gspot.toml`, unknown preset, unknown command, unanswered question, version pin mismatch |
