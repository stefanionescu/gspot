# Command Line

This document decides every command, flag, output line, and exit code. Each name is one that
`git`, `cargo`, `ruff`, `biome`, `mise`, or `gh` already has, used the way its source uses it.
One rule decides what exists: a flag exists when a test uses it and a guide shows it, and a
command exists when nothing else answers its question.

## Commands

```text
gspot init       [--yes] [--dry-run] [--from <profile>] [--configurations <names...>] [--without <names...>] [--scope <path=names...>]
                 [--hooks gspot|husky|lefthook|pre-commit|simple-git-hooks|existing] [--no-hooks] [--ci github|gitlab] [--no-ci]
                 [--runner mise|npm|pnpm|yarn|bun] [--no-runner] [--format keep|shipped]
                 [--no-rules] [--no-checks] [--no-install] [--allow-dirty]
gspot check      [<path>...] [--staged] [--changed[=<ref>]] [--fix] [--dry-run]
                 [--only <checks...>] [--skip <checks...>] [--stage commit|push|manual] [--no-cache]
gspot install    [--dry-run]
gspot apply      [--dry-run]
gspot list       [settings]
gspot explain    <check> | <tool>/<rule> | <configuration> | <setting> | <path>
gspot doctor
gspot ignore     <check> [--paths <glob>...] [--rule <rule>] [--reason <text>] [--remove]
gspot set        <setting> [<value>...] [--reason <text>] [--scope <path>] [--replace | --remove | --default]
gspot add        <configuration>... [--scope <path>] [--dry-run]
gspot remove     <configuration> [--scope <path>] [--dry-run]
gspot uninstall  [--dry-run] [--yes]
gspot export     <file>
gspot completion <bash|zsh|fish|powershell>

global: --help  --version  --json  --quiet  --verbose  --no-color  -C <dir>
env:    NO_COLOR  CI  GSPOT_JOBS  GSPOT_HOOK (set by the hooks gspot writes)
        GSPOT_BIN  GSPOT_REGISTRY (both only until the first release)
exit:   0 passed   1 findings   2 gspot did not run
```

Fifteen commands. A teammate who clones a repository runs one, `gspot install`. A developer
learns three more first: `gspot check`, `gspot check --changed`,
and `gspot check --staged`. Four commands write one entry of `gspot.toml`: `ignore`,
`set`, `add`, and `remove`.

Together they cover every value a finding makes a person change: a rule, a check, a limit, a
list, a configuration, a level. Four tables are written by hand, because each is a small structure
and no single value: `[[scope]]`, `[[check]]`, `[[naming.rules]]`, and the elements of
`[architecture]`. A hand edit is checked on load like any other.

## Conventions

The checklist is [clig.dev](https://clig.dev/). What it means here:

- Findings go to stdout. Messages about the run, such as progress and hints, go to stderr.
- `-h` and `--help` work on every command, and `--help` gives each flag one plain sentence.
- No color, no spinner, and no question without a terminal. A question that has no flag and no
  terminal is exit 2, and the message names the flag.
- A mistyped command or flag prints the closest match.
- `--dry-run` shows what happens and writes nothing. Every command that changes more than one
  line has it: `init`, `install`, `apply`, `add`, `remove`, `uninstall`,
  and `check --fix`. `ignore` and `set` change one line of a tracked file, and `git diff` shows
  it.
- One word names a thing: its name. A check, a configuration, a rule, and a setting each have a name.
  Domain identity uses `name`. Structural map keys and third-party identifiers retain their
  actual terms.
- A refusal is a `--no-` flag: `--no-ci`, `--no-hooks`, `--no-runner`, `--no-rules`,
  `--no-checks`, and `--no-install`. `--no-checks` installs the rule files and no check, and
  `--no-rules` installs the checks and no rule file. No flag takes the value `none`.
- A command that deletes prints its plan and asks, and `--yes` answers.
- Every finding ends with a `help:` line, taken from the `help` text of its check.
- A flag means one thing everywhere: `--scope`, `--reason`, `--json`, `--yes`, `--remove`.

The commands change one entry at a time, because that is the edit a person makes when a finding
appears. A bulk change is a hand edit of `gspot.toml` followed by `gspot apply`. Both give the
same file, validated the same way.

## `init`

Reads the repository, proposes a policy, and writes it after a yes.

### What it reads

1. The files git tracks or is about to track. Without a git repository it walks the folder and
   honors `.gitignore`, and the plan opens with a line that says so.
2. Project files: `package.json`, `pyproject.toml`, `requirements*.txt`, `Pipfile`,
   `Package.swift`, an Xcode project, `supabase/config.toml`, `wrangler.*`, `next.config.*`,
   `Dockerfile*`, a Compose file, and `nginx.conf`.
3. Scopes: every folder that holds a project file, and workspace members.
4. The format the repository has, from Prettier itself, then `.editorconfig`, then Biome.
5. Tool configuration, in files and in tables of `pyproject.toml` and `package.json`.
6. Hooks and what each hook calls, the CI system, agent files, and the tasks of the runner.

A language with a project file is proposed from that file. A language with no project file,
such as Bash or SQL, is proposed from its files. A tool configuration is proposed only where the
repository holds the tool.

### What it prints

```text
reading 3,330 tracked files

languages     typescript  api/package.json     swift  ios/Package.swift     sql 85 files     bash 99 files
frameworks    express     api/package.json
platforms     supabase    supabase/config.toml
scopes        api  supabase  ios               a project file in each
runner        mise                             mise.toml
hooks         .githooks/pre-commit             calls: mise run lint
ci            github
format        tabs, 100 columns                .prettierrc.yaml

found, not proposed
  python      1 file, no project file          gspot add python
```

### The questions

Asked in a terminal, in three groups. Each has a flag, and `--yes` takes every proposal.

| Question                               | Proposal                                                    | Flag                      |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| Projects found, in a monorepo          | all found; an unticked project goes into `exclude`          | `--scope`, `--without`    |
| Languages and frameworks found         | all found                                                   | `--configurations`, `--without`  |
| Tools found                            | all found                                                   | `--configurations`, `--without`  |
| Checks that fit any repository         | structure, naming, formatting, spelling, secrets            | `--configurations`, `--without`  |
| Where the gspot line of the hooks goes | the task the hook calls, then the hook file, then new hooks | `--hooks`, `--no-hooks`   |
| Write a CI job?                        | yes where no lint job exists                                | `--ci`, `--no-ci`         |
| Install rule files for agents?         | yes                                                         | `--no-rules`              |
| Which task names call gspot            | a new body for `lint` and `format` where they exist         | `--runner`, `--no-runner` |
| Keep your formatting?                  | keep, asked only where it differs from the shipped format   | `--format keep`           |

The level is not asked. `init` writes `level = "recommended"`.

### The plan

Printed before anything is written:

```text
write
  gspot.toml                       your policy, 41 lines
  .gspot/                          generated configuration, lint tools, version pin
  .mise/conf.d/gspot-tools.toml    9 tool pins, gspot 0.5.0
  .editorconfig                    written by gspot, with its mark
  AGENTS.md  detected agent files  .gitignore  .gitattributes    one managed block each
  .gspot/rules/                    14 rule files

change, after your yes
  mise.toml task lint              new body: gspot check
  .githooks/pre-commit             unchanged; it calls the task above

replace (original bytes saved under .gspot/state/recovery/)
  .prettierrc.yaml                 one tool owns it; your tabs and 100 columns go into [format]
  ios/.swiftlint.yml               one tool owns it; 2 rules off and 1 rule on are carried

carried into gspot.toml
  typos.toml                       14 words
  .gitleaks.toml                   6 allowlist entries
  eslint.config.mjs                3 rules off for tests/**, no-var on, as tools.eslint.rules

not carried
  eslint.config.mjs                the plugin eslint-plugin-foo, which gspot does not ship

not written
  CI                               Bitbucket found; paste these lines into your pipeline:
                                   gspot install  ·  gspot check  ·  keep .gspot/reports/report.json as an artifact

remove by hand, when ready
  .prettierignore, renovate.json   add .gspot/ so your own tools skip the files gspot writes
  pyproject.toml [tool.ruff]       read and carried; gspot never edits this file
  package.json                     eslint and 4 plugins of yours; gspot runs its own under .gspot/
  quality/                         a folder of lint scripts that nothing calls

Continue? [y/N]
```

A no writes nothing. After the yes, `init` runs `gspot install`. `--no-install` skips it and
prints that one command. `init` runs no check. Its last lines name the three commands a developer learns, and
`gspot check --fix`, so the developer decides when to lint and when to fix.

### Takeover

gspot deletes a file only when one tool owns it. A file that several tools read, such as
`setup.cfg`, `pyproject.toml`, or `package.json`, is read, its lint tables are carried, and the
plan lists it under what the developer removes by hand. gspot never writes a lint tool,
a pin, or a `prepare` script into `package.json`. The launcher `gspot` is the one package
it writes there, under an npm runner.

A rule is carried in both directions. A rule the old config turned off becomes an
`[[ignore]]` with its paths. A rule it turned on, with its options, becomes an entry of
`tools.<tool>.rules`. For ESLint, gspot resolves the config for every governed source path, groups equal results,
and carries differences with their path scope.

Unsupported settings retain their original file and appear in the plan.
The takeover contract is in [03-configuration.md](03-configuration.md). The plan lists every setting it did
not carry. Every carried entry has the reason `carried from <file> at init`.

Hooks a repository has keep running, tracked or local to one clone, and gspot never sets
`core.hooksPath`. Agent files are never read, split, or moved: gspot appends one managed block.

### Refusal

`init` refuses when `gspot.toml` exists, and points at `gspot doctor`. It also refuses, with
exit 2 and nothing written, in these cases:

- A choice flag holds a value outside its list. The message names the flag and the values.
- `--configurations` or `--without` names a configuration that does not exist, and the message names near
  matches.
- `--without` names a configuration that a selected configuration requires, and the message prints the chain.
- The working tree has uncommitted changes and `--allow-dirty` is absent.
- `--from` names a profile that does not load.

### Order of writes

`init` writes before it deletes:

1. Validate every flag, the profile, and the proposed `gspot.toml` in memory.
2. Validate path boundaries and save the exact bytes and permissions of every file or task
   being replaced under `.gspot/state/recovery/`. Failure leaves the originals in place.
3. Write the config, generated files, and managed blocks atomically. Resolve tool lockfiles
   through `apply`; `--no-install` skips environment installation, not lockfile resolution.
4. Run `gspot install`, unless `--no-install` was given. Run no check.
5. Delete a replaced original only after its replacement and recovery entry are complete.

A failed resolution leaves existing lockfiles and old configurations in place. The setup report
names incomplete steps and the command to retry. Missing tools do not undo completed setup
; no old file is deleted without a usable generated replacement and recoverable bytes.

## `install`

Sets up one clone. It installs the mise tools, the npm tools under `.gspot/node_modules`,
the Python tools under `.gspot/.venv`, and the hooks of this clone. It writes no tracked file and
is safe to run twice. It requires matching managed manifests and lockfiles and uses the immutable install commands in [03-configuration.md](03-configuration.md). Missing, stale, or conflicted locks fail with `Run: gspot apply, then gspot install`.

`init` and the CI job call it. A teammate runs it explicitly after cloning.
gspot never creates or changes `prepare`, `preinstall`, `install`, or `postinstall` package
scripts, and does not inject itself into a setup task. A clone that is not set up says so: `gspot check`, `gspot doctor`, and a missing
tool each print `Run: gspot install`. `check` never installs by itself.

A missing tool never blocks the setup. `install` runs every step, lists what is left
with the command for each, and exits 1 when a tool gspot installs itself did not install. The npm tools install with the package manager of
the repository, and with bun or npm where the repository has none.

## `check`

Runs checks and prints findings. `gspot check` is the truth, and the hooks are the fast path
.

| Form                                   | Runs                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                          | every check of the commit and push stages, over the whole repository           |
| `gspot check --staged`                 | the commit stage over staged files, which is what the commit hook runs         |
| `gspot check --changed`                | the commit and push stages over files that differ from the upstream branch     |
| `gspot check --changed=<ref>`          | the same from an explicit ref; pre-push uses its own ref protocol              |
| `gspot check --stage manual`           | the checks that build, test, or scan a whole project, or that need the network |
| `gspot check src/app.ts docs`          | those files and folders, as `eslint` and `ruff check` take paths               |
| `gspot check api`                      | one project of a monorepo, because a scope is a folder                         |
| `gspot check --only typescript/eslint` | one check; list more names after the same flag                                 |
| `gspot check --fix`                    | every fixer in order, then the checks again                                    |
| `gspot check --fix --dry-run`          | the diff of every fix, and no write                                            |
| `gspot check --skip <checks...>`       | skips the named checks this run, printed and recorded                          |

A changed-file run narrows file-list checks, not the findings of a project-wide check.
A project-wide check runs when a changed, deleted, or renamed path affects its inputs. Every
finding from that check contributes to its exit code, including findings in unchanged callers
and findings without a file. Tool failures and invalid configuration also fail the run.
Existing project errors can therefore block a changed-file run; no baseline or hidden filter
suppresses them. [10-hooks-ci-runners.md](10-hooks-ci-runners.md) defines revision selection.

A check above the level of the repository is not planned. A check that waits for a setting
prints `skipped` and names the setting. A check whose tool is absent prints `missing` and fails
with the install hint of the runner the repository uses. A check whose file set is empty does
not run and does not print. Status words are lowercase: `ok`, `unchanged`, `fail`, `missing`,
`error`, and `skipped`.

Results are cached in `.gspot/cache/`. The key holds the tool version, the config files the
check names, and the content of every file it read. A cached pass prints `unchanged`. Entries
older than 30 days are dropped.

In a folder with no git, `gspot check` runs every check that needs no history. `--staged` and
`--changed` exit 2 there with one sentence that says why. With no upstream,
`--changed` uses a resolvable default branch and says which ref it took; if neither exists it exits 2 and asks for an explicit ref. In a shallow clone it names
`git fetch --unshallow`.

A wrong line in `gspot.toml` does not stop `check`. The run uses the rest of the config and
reports the line as a finding of `integrity/policy`. A TOML syntax error or unsafe path is exit 2. Invalid security or execution settings are never partially executed.

### Output

A line prints as each check ends. The end of the run lists what failed, was missing, or
was skipped, and then a summary.

```text
api        typescript/tsc            ok        512 files   4.2s
api        typescript/eslint         fail      512 files  21.4s
  src/routes/turn.ts:41:3  gspot/no-trivial-functions  This function passes its arguments straight through to buildTurn.
    help: Call buildTurn directly and delete this function, or give it real work.
  reproduce: gspot check api --only typescript/eslint
supabase   sql/sqlfluff              unchanged  83 files
ios        swift/swiftlint           missing   swiftlint 0.63.2 is not installed. Run: mise install

failed: typescript/eslint, swift/swiftlint
12 checks passed, 2 failed, 3 findings, 26 s
```

`gspot check` reports what it finds today. Nothing records old findings, and nothing is held
back. A failing run from a hook ends with the
command that reproduces it and with `git commit --no-verify` as the way past it.

Every run but the message run writes three files under `.gspot/`: `report.json`,
`report.sarif`, and `report.codequality.json`, the form GitLab reads. A CI job keeps them as
artifacts, so no flag and no redirect is needed.

The pre-push hook calls `gspot check --push`, a hook-only option that consumes the Git ref
updates on stdin and checks their committed content. It is hidden from ordinary help.

The commit message hook calls `gspot check --stage message --message-file <path>`. That stage
and that flag serve the hook alone, and `--help` leaves both out.

`--quiet` prints failures only. `--verbose` prints every command and every ignore with its
reason. `--json` prints the report as JSON. Columns are computed from the longest check name.

## `apply`

Use the installed binary to preview generated changes with `gspot apply --dry-run`. Application
accepts a changed version pin, preserves custom policy, and records the new pin only after all
outputs and locks apply successfully. An edited output or failed write must not advance the pin.
Run `gspot install` afterward to install locked tools. Package managers update gspot itself.
No upgrade command, version migration table, or newer-version lookup exists.

Writes generated configuration and resolves the tool lockfiles from `gspot.toml`.
`--dry-run` prints the proposed changes without writing project files. Dependency resolution
uses a temporary environment and can require the network; failure never replaces a lockfile.
A dry run prints unresolved operations when the resolver is unavailable and exits 2 rather
than claiming a complete diff.

- It writes `.gspot/<tool-file>` for each tool, `.gspot/package.json`, the mise file, approved tracked hook composition,
  the CI job, the managed blocks, and the rule files.
- It deletes obsolete managed output only under the boundary, ownership-hash, and recovery rules of [03-configuration.md](03-configuration.md). A mark alone is not permission to delete modified content.
- It never writes `gspot.toml`. Shared-file edits are limited to managed blocks and the
  accepted launcher and task entries listed in the ownership contract.
- It retains matching lockfiles. It resolves missing, stale, or conflicted lockfiles, then
  writes validated results atomically. It installs no tools or clone-local hooks; approved tracked hook configuration is an output.

Drift is a check: `integrity/generated-drift` fails a generated file that differs from what the
policy writes.

## `list`

`gspot list` prints what exists and what is on. Configurations come in three groups: installed,
found in the repository and not selected, and the rest. Under each installed configuration stand its
checks with their state: `on`, `off (level)`, `off (ignore)`, or `waits for <setting>`. Each
configuration of the second group ends with its `gspot add` line.

`gspot list settings` prints every setting of the selection: the setting name, its value, and where the
value comes from.

## `explain`

One verb that says what a thing is. It takes:

| Argument                                    | Prints                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| a check name (`structure/trivial-function`) | `summary`, `why`, and `help`; its configuration and level; its settings; the `ignore` line that turns it off |
| a tool rule (`markdownlint/MD024`)          | the summary of the tool where it has one, the page of the rule, and the check that runs it            |
| a configuration name (`python`)                    | what it detects and claims, its tools, its checks by stage and level, its settings, its rule files    |
| a setting name (`limits.function_lines`)    | meaning, default, the value in every scope that holds it, and the `set` line that changes it          |
| a path (`api/src/routes/turn.ts`)           | the configurations that claim the file, and the checks that read it at each stage                            |

Every text `explain` prints is written for a person who does not code. The same text is the
page of the manual.

## `doctor`

Prints what is wrong, and what changed in the repository after `init`. Each line with a remedy
ends with its command. `doctor` calls no network and changes nothing.

```text
tools
  ok        eslint 9.38.0            .gspot/node_modules/.bin/eslint
  ok        shellcheck 0.11.0        mise
  missing   swiftlint 0.63.2         mise install

files no check reads          4
  assets/data.kt                     no configuration reads Kotlin

file kinds with no format, syntax, style, or type check
  .vue                               gspot add vue

detected, not selected
  nextjs                             next in package.json        gspot add nextjs

files gspot did not write
  .gspot/notes.json                  no mark; gspot leaves it alone

remove by hand
  api/package.json                   eslint 8.57.1 and 3 plugins; gspot runs its own under .gspot/

hooks      run in this clone          .githooks/pre-commit calls mise run lint
ci         github
rules      14 files
gspot      0.4.0 pinned and running
last full run   2026-09-19
```

The hooks line comes from git, not from the config. It names one of three states: the hooks
run, the hooks exist and this clone does not run them, or none exist. The second state ends with
`gspot install`. Exit 0 unless a tool is missing, outside its accepted version range, or cannot be probed.

## `ignore`

`gspot ignore <check> --paths "scripts/**" --reason "One launcher script for each environment."`
appends an `[[ignore]]` entry, validates the file, and prints the entry.

The reason is optional. When it is there, it is stored with the entry and printed with
`--verbose`. A repository that wants a reason on every ignore and every loosened limit sets
`require_reasons = true`. `--rule` narrows to one rule inside the check. Without
`--paths` the entry holds for the whole scope, which is how a rule of a tool is turned off. This
is the one way to turn a rule off, for every tool.

An entry with the same check, rule, and
reason gains the path, so one reason is one entry. `--remove` deletes a matching entry, and the
check is on again from the next run. A spelling finding prints the
`gspot set tools.typos.words <word>` line that accepts its word.

One comment form silences a finding of a gspot engine, for every check that engine runs:

```text
// gspot-ignore structure/trivial-function -- The public name is the stable one.
# gspot-ignore naming/identifiers -- Platform API name.
```

A suppression without a reason is a finding, in every comment style gspot reads.

## `add`, `remove`

`gspot add nextjs vitest` appends configurations to the root selection, or to a scope with `--scope`.
It runs `apply` and `install`, and runs no check. `gspot set level all`, a rule turned
back on, and an upgrade that brings new rules work the same way: the checks are on from the next
run. `gspot remove vitest`
does the reverse, files included.

## `set`

`gspot set limits.function_lines 80 --reason "Route tables are one ordered list each."` writes one
setting, by the dotted name `gspot list settings` prints. A reason is optional, unless the
repository sets `require_reasons`. `--scope` targets a scope. An unknown key fails with the keys that exist
under that table.

`gspot set extra_checks structure/single-file-folder` turns on one check above the level of the
repository, and `gspot set level all` turns on all of them. For a list the values are
appended. `--replace` replaces the list, `--remove` removes the named
values, and `--default` deletes the key. `gspot set generated "api/types/supabase.ts"` and
`gspot set vendored "vendor/**" --reason "..."` say what a file is. A rule of a tool takes its
options or `error` under `tools.<tool>.rules.<rule>`, and `off` is refused with the
`gspot ignore` line that does it.

## Writing `gspot.toml`

The four writing commands share one writer. It parses the file with its comments and order
intact, changes one entry, validates the whole file as load does, and writes it through a
temporary file and a rename. Then it runs `apply` and prints the lines it wrote. The file is
tracked, so `git diff` shows the edit.

## `uninstall`

Removes only recorded, unchanged gspot-owned outputs and its managed blocks.
It restores replaced files and task bodies when the current value still matches the value
gspot installed. A developer edit is preserved and reported for manual recovery.

It never removes `.gspot/` recursively. Unmarked files, modified outputs, and recovery entries
remain. Empty owned directories can be removed. The command leaves `gspot.toml` and prints
the path of each retained recovery entry. A partially missing installation can still be removed
from its ownership record without loading tool configurations.

## `export`

A profile carries a setup between repositories.
[03-configuration.md](03-configuration.md) holds the format.

`gspot export <file>` writes a profile from this repository. It keeps the level, the configurations,
`extra_checks`, `[limits]`, `[naming]` lists, `[format]`, and `[prose]`. It keeps the options and
the rules of each tool, and the choices for hooks, CI, rules, and runner. It keeps every `[[ignore]]` that names no
path. It leaves out every entry that names a path, and prints each one.

`gspot init --from <profile>` takes a path, an `https` address, or
`github:owner/repo[/path][@ref]`. A remote profile is fetched once, and the plan prints its
SHA-256. `init --from <profile> --dry-run` validates a profile and writes nothing. Flags given
beside `--from` win over the profile.

## Global behavior

- `--json` works on every command that prints a report, and each shape is documented, so an
  agent drives gspot without parsing columns.
- `-C <dir>` runs as if started in that folder. Every command works from the repository root.
- The repository pins a gspot version in `.gspot/version`. A binary of another version exits 2
  on every command that reads the policy except `apply` and recovery through `uninstall`, and names the pinned version.
  [11-toolchain.md](11-toolchain.md) has the install paths.
- gspot runs natively on macOS, Linux, and Windows. A check whose tool has no Windows
  build is a platform skip there.
- gspot sends nothing anywhere. It has no telemetry. It reaches the network in
  lock resolution during apply, in the install of tools, and in checks that declare `network`.
- Every message says what happened and what to do next, in plain words, and names the command.

## Exit codes

| Code | Meaning                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 0    | every check ran and passed, or the command completed                                                                   |
| 1    | findings, a generated file that drifted, or a missing tool                                                             |
| 2    | gspot did not run: unreadable `gspot.toml`, unknown configuration, unknown command, unanswered question, version pin mismatch |

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance D-129

The [command surface](#commands) owns supported commands and flags. Keep one implementation
per command, with no removed-name aliases or compatibility forwarding. Explain supports paths,
checks, configurations, rules, and settings. Set writes supported generated and vendored declarations.
Doctor performs local diagnosis without network access. Apply previews through `--dry-run`.

Exercise completion for supported commands, values, and paths (T-22). Verify observable explain,
set, and preview behavior. Do not assert a fixed command count or test removed commands solely
to preserve refactoring history.

### Acceptance D-100

Managed tool configuration lives under `.gspot/`. Native editors can require a root pointer
or an explicitly owned root configuration, such as `.editorconfig`. Those files must follow
the owning tool's loading contract and lifecycle preservation rules.

Verify that the pinned consumer loads the generated configuration, that required native root
integration works, and that unrelated files remain unchanged. Do not require a fixed root-file
inventory or forbid the root integrations the adoption contract explicitly supports.

### Acceptance K-111

A finding is silenced by `[[ignore]]` with `check`, `rule`, `paths`, and `reason`, or
by one `gspot-ignore` comment with a reason. Nothing else.

Shell analyses interpret `gspot-ignore` through the shared suppression owner. Removed
exception fields have no compatibility path.

Run the four affected Bash analyses over real functions. A reasoned
`gspot-ignore` suppresses its target while another finding remains visible.

### Acceptance K-259

Hand entries first, then the managed block, and no entry for a path that does not
exist.

The harness runs a tool with the planted folder as its working directory, never the
root of gspot.

After the full suite, `git status --ignored` names no `.pytest_cache` at the root.

### Acceptance K-290

Installing gspot runs no check, and nothing records old findings. `gspot check`
reports what it finds today. An old repository adopts gspot through the files a change touches,
the level `recommended`, `gspot ignore`, and `git commit --no-verify`.

`execute.ts` loses the baseline step between the findings and the verdict, so a
finding that is not ignored fails its check. The manifest keys `baseline_file`,
`baseline_command`, and `prune_command` go. ESLint loses `{suppressions}`, and basedpyright loses
`--baselinefile`. The CI job checks what a change touches, and `[ci] run = "all"` makes it
check everything.

The planted installs hold that `init` starts no tool but the installers. A planted
repository with an old finding in an untouched file commits a change to another file.

### Acceptance K-62

`gspot list` prints configurations in three groups: installed, found in the repository and
not selected, and the rest. Under each installed configuration it prints its checks with their state:
on, off by level, off by an ignore, or waiting for a setting. `gspot list settings` prints every
setting with its value and where the value comes from.

List and explain use the same effective check selection and setting prerequisites. Each configuration
found but not selected ends with its `gspot add` line. `--json` prints the same data.

Exercise each effective state through list and explain, including their structured output.

### Acceptance K-64

Three questions: the languages and frameworks found, the tools found, and
the checks that fit any repository, each with its proposed set already marked.

A manifest `kind` decides the group. A group with nothing found is not asked.

Verify the proposed selections and accepted result, including empty groups and noninteractive
initialization. Do not assert a fixed prompt-call count.

### Acceptance K-66

The words of [public vocabulary](README.md#glossary). `[runner] surface` becomes `[runner] tool`.
The run record becomes the report: `.gspot/reports/report.json`.

`[inspection] strict` becomes `[coverage] strict`. `[[declare]]` becomes `[[generated]]` with `paths`,
and `[[vendored]]`. Policy becomes config in text a person reads.

A key rename follows the public names contract, with its row in the names table. Type names inside the
code change only where the table says so.

Contract tests compare domain terminology in help, reports, schemas, and generated reference against [public vocabulary](README.md#glossary). Do not ban words globally. A real map key, third-party identifier, historical rename, or task-runner description is not a terminology defect.

### Acceptance K-81

A line prints as each check ends. The end of the run lists failed, missing,
and skipped checks alone, then a summary with counts and the time. In CI the findings print to
the log, and the JSON report is written beside them.

`execute.ts` takes an `onResult` callback, and `progress.ts` prints one line for each
result on a terminal, and one line for each failed result elsewhere. A cached pass prints
`unchanged`. The summary is one line: checks passed, checks failed, findings, and
seconds. The workflow runs plain `gspot check`, so the findings are in the log, and it keeps
`.gspot/reports/report.*` as artifacts. No flag is needed, because every run writes those files.

Exercise progress output through its output owner and verify live findings and report artifacts
through the workflow behavior. Preserve terminal and nonterminal output contracts.

### Acceptance K-82

`doctor` asks git whether the hooks run in this clone. A file counts as unchecked
only when a linter exists that reads its kind, and `check` and `doctor` print the same count.

`hooksLine` reads `git config core.hooksPath` and the hook files, and says which of
three states holds: the hooks run, the hooks exist and this clone does not run them, or none
exist. It ends with the setup command of the repository. `coverage.ts` owns one function
that both commands call, and it leaves out files whose nature is `binary`, `generated`, or
`vendored`.

A unit test of each hooks state. A planted repository of images alone holds a count of
zero.

### Acceptance K-166

`doctor` and `gspot list` report which looks each file ending gets: format, syntax,
style, and types. An ending that gets only the general ones is named.

Rename the check's `inspection` list to `coverage` and the manifest's `[inspections]` table to `[coverage]` (K-308). `coverage.ts` groups the claimed endings by the check kinds supplied by their checks, and prints one line for an
ending with none of the four.

A planted repository with `.kt` files holds a line that names the ending.

### Acceptance K-122

Each message says what happened in the words of [public vocabulary](README.md#glossary).

`askMany` prints the list it took and the flag that changes it. The apply preview
compares the rule lists of two template renders as data, for every tool whose template lists
rules, through a `rules_path` key of the config in the manifest. `explain` walks every scope and
prints the value of each that holds the key. A load error prints the file, the line, and one
sentence. The uninstall plan prints the hooks line only when the path will be unset.

Unit tests for each message, and an apply test repository where SwiftLint gains a rule.

### Acceptance K-95

The table of [02-cli.md](02-cli.md): `--dry-run` on `init`, `apply`,
`uninstall`, and `check --fix`; `--no-ci`, `--no-hooks`, `--no-runner`, `--no-rules`, and
`--no-install`; `check --changed[=<ref>]`, with the upstream branch as the default ref;
`[hooks] push = "changed"` or `"all"`.

`--changed` resolves `@{upstream}` and falls back to the default branch of the remote.
The global flags `--json`, `--quiet`, `--verbose`, and `--no-color` are read once in `program.ts`
(K-98).

Verify supported flags through parsing and observable behavior, and confirm generated help and
completion derive from the same command definitions.

### Acceptance K-284

`ignore`, `set`, `add`, and `remove` mutate config and apply the resulting policy.

Planning selects a check whose level is within the level of the repository, or whose name
is in `extra_checks`. `emit/tool-packages.ts` and `tool-environment.ts` leave out a tool
whose every check has an `[[ignore]]` with no rule and no paths.

The `help:` line of a spelling finding prints `gspot set tools.typos.words <word>`. The profile
schema accepts an `[[ignore]]` with no `paths`, and `export` prints each entry it leaves out.

A planted repository at `recommended` turns on `structure/single-file-folder` through
`extra_checks`, and the next run reports it. An exported profile with one pathless ignore starts a
second repository with that rule off. A tool with every check ignored is absent from
`.gspot/package.json`.

### Acceptance K-287

The exact definition/reference mappings of [public vocabulary](README.md#glossary) (K-308).

Usage lines show `<check>`, `<configuration>`, `<rule>`, and `<setting>`. `install`, `apply`, `add`,
and `remove` take `--dry-run`, and each prints its plan and writes nothing,
through the plan text `init` already has. `reason` is optional in the schema. `loosening.ts` and the
refused reasons of `reasons.ts` apply only where `require_reasons = true`.

Contract tests verify name-based manifests, domain types, help and report fields; they allow real map keys, Git object IDs, SPDX identifiers and SARIF `ruleId`. A
planted `gspot ignore` with no reason writes the entry. The same command with `require_reasons`
on exits 2.

### Acceptance K-291

`gspot check [<path>...]`, `--only <check>`, and `exclude` in `gspot.toml`.

`plan.ts` keeps the files under the given paths, and then the checks that claim them.
A path that is a scope plans the whole-project checks of that scope too. `tracked.ts` drops the
files under `exclude` before anything else reads them, so no check, no count, and no `doctor`
line sees them. The first question of `init` in a monorepo lists the projects found, and an
unticked one goes into `exclude`. The reproduce line is `gspot check <path> --only <check>`.

A planted monorepo of three projects takes two at `init`, and `gspot check` reads no
file of the third. `gspot check api/src/a.ts --fix` changes that one file.
