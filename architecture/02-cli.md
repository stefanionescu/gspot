# Command Line

This document decides every command, flag, output line, and exit code. Each name is one that
`git`, `cargo`, `ruff`, `biome`, `mise`, or `gh` already has, used the way its source uses it.
One rule decides what exists: a flag exists when a test uses it and a guide shows it, and a
command exists when nothing else answers its question (D-131).

## Commands

```text
gspot init       [--yes] [--dry-run] [--from <profile>] [--presets <names>] [--without <names>] [--scope <path=names>]
                 [--hooks gspot|husky|lefthook|pre-commit|simple-git-hooks|existing] [--no-hooks] [--ci github|gitlab] [--no-ci]
                 [--runner mise|npm|pnpm|yarn|bun] [--no-runner] [--format keep|shipped]
                 [--no-rules] [--no-checks] [--no-install] [--allow-dirty]
gspot check      [<check>] [--staged] [--changed] [--since <ref>] [--fix] [--dry-run]
                 [--stage commit|push|manual] [--scope <path>] [--skip <check>] [--no-cache]
gspot install    [--dry-run]
gspot apply      [--dry-run]
gspot baseline   [<check>] [--dry-run]
gspot list       [settings | baseline [<check>]]
gspot explain    <check> | <tool>/<rule> | <preset> | <setting> | <path>
gspot doctor
gspot ignore     <check> [--paths <glob>...] [--rule <rule>] [--reason <text>] [--remove]
gspot set        <key> [<value>...] [--reason <text>] [--scope <path>] [--replace | --remove | --default]
gspot add        <preset>... [--scope <path>] [--dry-run]
gspot remove     <preset> [--scope <path>] [--dry-run]
gspot upgrade    [--dry-run] [--to <version>] [--yes] [--no-install]
gspot uninstall  [--dry-run] [--yes]
gspot export     <file>
gspot completion <bash|zsh|fish|powershell>

global: --help  --version  --json  --quiet  --verbose  --no-color  -C <dir>
env:    NO_COLOR  CI  GSPOT_JOBS  GSPOT_HOOK (set by the hooks gspot writes)
        GSPOT_BIN  GSPOT_REGISTRY (both only until the first release)
exit:   0 passed   1 findings   2 gspot did not run
```

Sixteen commands. A teammate who clones a repository runs one, `gspot install`. A developer
learns three more first: `gspot check`, `gspot check --changed`,
and `gspot check --staged` (D-123). Four commands write one entry of `gspot.toml`: `ignore`,
`set`, `add`, and `remove`.

Together they cover every value a finding makes a person change: a rule, a check, a limit, a
list, a preset, a level. Four tables are written by hand, because each is a small structure
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
  line has it: `init`, `install`, `apply`, `baseline`, `add`, `remove`, `upgrade`, `uninstall`,
  and `check --fix`. `ignore` and `set` change one line of a tracked file, and `git diff` shows
  it (D-163).
- One word names a thing: its name. A check, a preset, a rule, and a setting each have a name,
  and no document says id or key (D-163).
- A refusal is a `--no-` flag: `--no-ci`, `--no-hooks`, `--no-runner`, `--no-rules`,
  `--no-checks`, and `--no-install`. `--no-checks` installs the rule files and no check, and
  `--no-rules` installs the checks and no rule file (D-81). No flag takes the value `none` (D-130).
- A command that deletes prints its plan and asks, and `--yes` answers.
- Every finding ends with a `help:` line, taken from the `fix` text of its check.
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
3. Scopes: every folder that holds a project file, and workspace members (D-108).
4. The format the repository has, from Prettier itself, then `.editorconfig`, then Biome.
5. Tool configuration, in files and in tables of `pyproject.toml` and `package.json`.
6. Hooks and what each hook calls, the CI system, agent files, and the tasks of the runner.

A language with a project file is proposed from that file. A language with no project file,
such as Bash or SQL, is proposed from its files. A tool preset is proposed only where the
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

Asked in a terminal, in three groups (D-120). Each has a flag, and `--yes` takes every proposal.

| Question                               | Proposal                                                    | Flag                      |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| Languages and frameworks found         | all found                                                   | `--presets`, `--without`  |
| Tools found                            | all found                                                   | `--presets`, `--without`  |
| Checks that fit any repository         | structure, naming, formatting, spelling, secrets            | `--presets`, `--without`  |
| Where the gspot line of the hooks goes | the task the hook calls, then the hook file, then new hooks | `--hooks`, `--no-hooks`   |
| Write a CI job?                        | yes where no lint job exists                                | `--ci`, `--no-ci`         |
| Install rule files for agents?         | yes                                                         | `--no-rules`              |
| Which task names call gspot            | a new body for `lint` and `format` where they exist         | `--runner`, `--no-runner` |
| Keep your formatting?                  | keep, asked only where it differs from the shipped format   | `--format keep`           |

The level is not asked. `init` writes `level = "recommended"` (D-119).

### The plan

Printed before anything is written:

```text
write
  gspot.toml                       your policy, 41 lines
  .gspot/                          generated configuration, lint tools, version pin
  .mise/conf.d/gspot-tools.toml    9 tool pins, gspot 0.5.0
  .editorconfig                    written by gspot, with its mark
  CLAUDE.md  AGENTS.md  .gitignore  .gitattributes    one managed block each
  .gspot/rules/                    14 rule files

change, after your yes
  mise.toml task lint              new body: gspot check
  .githooks/pre-commit             unchanged; it calls the task above

delete (git keeps them: git show HEAD:<path>)
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
                                   gspot install  ·  gspot check  ·  keep .gspot/report.json as an artifact

remove by hand, when ready
  .prettierignore, renovate.json   add .gspot/ so your own tools skip the files gspot writes
  pyproject.toml [tool.ruff]       read and carried; gspot never edits this file
  package.json                     eslint and 4 plugins of yours; gspot runs its own under .gspot/
  quality/                         a folder of lint scripts that nothing calls

Continue? [y/N]
```

A no writes nothing. After the yes, `init` runs `gspot install`. `--no-install` skips it and
prints that one command. Then `init` runs the commit stage once, holds what it finds, and
prints one line for each check that holds findings. It prints the security, dependency, and
secret counts apart from the others. It ends by offering `gspot check --fix`, with the number of
files the fix run changes (D-103).

### Takeover

gspot deletes a file only when one tool owns it (D-109). A file that several tools read, such as
`setup.cfg`, `pyproject.toml`, or `package.json`, is read, its lint tables are carried, and the
plan lists it under what the developer removes by hand (D-117). gspot never writes a lint tool,
a pin, or a `prepare` script into `package.json` (D-145). The launcher `gspot` is the one package
it writes there, under an npm runner (D-147).

A rule is carried in both directions (D-150). A rule the old config turned off becomes an
`[[ignore]]` with its paths. A rule it turned on, with its options, becomes an entry of
`tools.<tool>.rules`. For ESLint, gspot asks ESLint for the final config of one file of each
kind, and carries the difference from the config it writes. The plan lists every setting it did
not carry. Every carried entry has the reason `carried from <file> at init`.

Hooks a repository has keep running (D-101). gspot sets `core.hooksPath` only where no hooks
exist. Agent files are never read, split, or moved: gspot appends one managed block.

### Refusal

`init` refuses when `gspot.toml` exists, and points at `gspot doctor`. It also refuses, with
exit 2 and nothing written, in these cases:

- A choice flag holds a value outside its list. The message names the flag and the values.
- `--presets` or `--without` names a preset that does not exist, and the message names near
  matches.
- `--without` names a preset that a selected preset requires, and the message prints the chain.
- The working tree has uncommitted changes and `--allow-dirty` is absent.
- `--from` names a profile that does not load.

### Order of writes

`init` writes before it deletes (D-83):

1. Validate every flag, the profile, and the proposed `gspot.toml` in memory.
2. Write `gspot.toml`, `.gspot/`, and the managed blocks, each file through a temporary file and
   a rename (D-152).
3. Install the tools and run the first check.
4. Delete the files takeover replaces.

A failure in step 2 or 3 leaves every old file in place, and the message says so.

## `install`

Sets up one clone (D-156). It installs the mise tools, the npm tools under `.gspot/node_modules`,
the Python tools under `.gspot/.venv`, and the hooks of this clone. It writes no tracked file and
is safe to run twice.

`init`, `upgrade`, and the CI job call it. With a yes, `init` adds this one
line to the setup entry the repository already has, such as a `setup` task or a `prepare`
script (D-115). A clone that is not set up says so: `gspot check`, `gspot doctor`, and a missing
tool each print `Run: gspot install`. `check` never installs by itself.

## `check`

Runs checks and prints findings. `gspot check` is the truth, and the hooks are the fast path
(D-122).

| Form                            | Runs                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                   | every check of the commit and push stages, over the whole repository           |
| `gspot check --staged`          | the commit stage over staged files, which is what the commit hook runs         |
| `gspot check --changed`         | the commit and push stages over files that differ from the upstream branch     |
| `gspot check --since <ref>`     | the same, from another ref                                                     |
| `gspot check --stage manual`    | the checks that build, test, or scan a whole project, or that need the network |
| `gspot check typescript/eslint` | one check                                                                      |
| `gspot check --scope api`       | one scope                                                                      |
| `gspot check --fix`             | every fixer in order, then the checks again                                    |
| `gspot check --fix --dry-run`   | the diff of every fix, and no write                                            |
| `gspot check --skip <id>`       | skips one check this run, printed and recorded                                 |

A check above the level of the repository is not planned. A check that waits for a setting
prints `skipped` and names the setting. A check whose tool is absent prints `missing` and fails
with the install hint of the runner the repository uses. A check whose file set is empty does
not run and does not print. Status words are lowercase: `ok`, `unchanged`, `fail`, `missing`,
`error`, and `skipped`.

Results are cached in `.gspot/cache/`. The key holds the tool version, the config files the
check names, and the content of every file it read. A cached pass prints `unchanged`. Entries
older than 30 days are dropped.

In a folder with no git, `gspot check` runs every check that needs no history. `--staged`,
`--changed`, and `--since` exit 2 there with one sentence that says why. With no upstream,
`--changed` uses the default branch and says which ref it took. In a shallow clone it names
`git fetch --unshallow`.

A wrong line in `gspot.toml` does not stop `check`. The run uses the rest of the config and
reports the line as a finding of `integrity/policy`. A TOML syntax error is exit 2.

### Output

A line prints as each check ends (D-124). The end of the run lists what failed, was missing, or
was skipped, and then a summary.

```text
api        typescript/tsc            ok        512 files   4.2s
api        typescript/eslint         fail      512 files  21.4s
  src/routes/turn.ts:41:3  gspot/no-call-through  This function passes its arguments straight through to buildTurn.
    help: Call buildTurn directly and delete this function, or give it real work.
  reproduce: gspot check typescript/eslint --scope api
supabase   sql/sqlfluff              unchanged  83 files
ios        swift/swiftlint           missing   swiftlint 0.63.2 is not installed. Run: mise install

baseline   security/semgrep 3   dependencies/osv 1      gspot list baseline <check>
rose       typescript/eslint:vitest/expect-expect  2 new in src/routes/turn.test.ts; 97 in the baseline elsewhere

failed: typescript/eslint, swift/swiftlint
12 checks passed, 2 failed, 101 findings in the baseline, 3 new, 26 s
```

When a held count rises, the run prints the findings of the files whose count rose, and one line
that counts the rest (D-104). Every full run prints one `baseline` line for the security,
dependency, and secret checks that hold findings. A failing run from a hook ends with the
command that reproduces it and with `git commit --no-verify` as the way past it.

Every run but the message run writes three files under `.gspot/`: `report.json`,
`report.sarif`, and `report.codequality.json`, the form GitLab reads. A CI job keeps them as
artifacts, so no flag and no redirect is needed.

The commit message hook calls `gspot check --stage message --message-file <path>`. That stage
and that flag serve the hook alone, and `--help` leaves both out.

`--quiet` prints failures only. `--verbose` prints every command and every ignore with its
reason. `--json` prints the report as JSON (D-105). Columns are computed from the longest check name.

## `apply`

Writes every generated file from `gspot.toml`, and does nothing else. It takes no flag.

- It writes `.gspot/<tool-file>` for each tool, `.gspot/package.json`, the mise file, the hooks
  or the hook line, the CI job, the managed blocks, and the rule files.
- It deletes a file only when the file carries the mark of gspot and the policy does not
  write it. A file with no mark is never deleted (D-100).
- It never writes `gspot.toml`, and never writes into a file of the developer outside a managed
  block.

Drift is a check: `integrity/generated-drift` fails a generated file that differs from what the
policy writes (D-152).

## `baseline`

The baseline is the list of findings that were already in the repository when gspot arrived. gspot
writes them down, one count for each rule and file, in `.gspot/baseline.json`. A run passes as
long as no count goes up, so old problems do not block anybody and new ones fail at once. When
somebody fixes old findings, the counts in the file are too high, and `gspot baseline` lowers
them to what the last full run found. A count never goes up by a command.

`gspot list baseline` prints what the baseline holds, and `gspot list baseline <check>` prints the
findings of one check.
`gspot baseline <check>` runs one check and writes its first counts, for a check that starts
to work after `init` (D-132). It never raises a count, and it refuses a report that is not a
full run. Baselines live in one file, `.gspot/baseline.json`, sorted, one path on a line.

## `list`

`gspot list` prints what exists and what is on (D-118). Presets come in three groups: installed,
found in the repository and not selected, and the rest. Under each installed preset stand its
checks with their state: `on`, `off (level)`, `off (ignore)`, or `waits for <setting>`. Each
preset of the second group ends with its `gspot add` line.

`gspot list settings` prints every setting of the selection: the key, its value, and where the
value comes from.

## `explain`

One verb that says what a thing is. It takes:

| Argument                                 | Prints                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| a check name (`structure/call-through`)  | `summary`, `why`, and `fix`; its preset and level; its settings; the `ignore` line that turns it off |
| a tool rule (`markdownlint/MD024`)       | the summary of the tool where it has one, the page of the rule, and the check that runs it           |
| a preset name (`python`)                 | what it detects and claims, its tools, its checks by stage and level, its settings, its rule files   |
| a setting name (`limits.function_lines`) | meaning, default, the value in every scope that holds it, and the `set` line that changes it         |
| a path (`api/src/routes/turn.ts`)        | the presets that claim the file, and the checks that read it at each stage                           |

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
  assets/data.kt                     no preset reads Kotlin

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
the setup command of the repository (D-115). Exit 0 unless a tool is missing or outdated.

## `ignore`

`gspot ignore <check> --paths "scripts/**" --reason "One launcher script for each environment."`
appends an `[[ignore]]` entry, validates the file, and prints the entry.

The reason is optional. When it is there, it is stored with the entry and printed with
`--verbose`. A repository that wants a reason on every ignore and every loosened limit sets
`require_reasons = true` (D-164). `--rule` narrows to one rule inside the check. Without
`--paths` the entry holds for the whole scope, which is how a rule of a tool is turned off. This
is the one way to turn a rule off, for every tool.

An entry with the same check, rule, and
reason gains the path, so one reason is one entry. `--remove` deletes a matching entry, and the
check then runs through the widening step below. A spelling finding prints the
`gspot set tools.typos.words <word>` line that accepts its word.

One comment form silences a finding of a gspot engine, for every check that engine runs:

```text
// gspot-ignore structure/call-through -- The public name is the stable one.
# gspot-ignore naming/identifiers -- Platform API name.
```

A suppression without a reason is a finding, in every comment style gspot reads.

## `add`, `remove`

`gspot add nextjs vitest` appends presets to the root selection, or to a scope with `--scope`.
It runs `apply` and then the widening step (D-143): the new checks run once, their findings are
held, and the output says how many were held for each check. `gspot set level all`, a rule
turned back on, and an upgrade that brings new rules take the same step. `gspot remove vitest`
does the reverse, files included.

## `set`

`gspot set limits.function_lines 80 --reason "Route tables are one ordered list each."` writes one
setting, by the dotted key `gspot list settings` prints. A reason is optional, unless the
repository sets `require_reasons`. `--scope` targets a scope. An unknown key fails with the keys that exist
under that table.

`gspot set extra_checks structure/single-file-folder` turns on one check above the level of the
repository, and `gspot set level all` turns on all of them (D-160). For a list the values are
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

## `upgrade`

`gspot upgrade --dry-run` prints what the newer version changes and writes nothing. It lists
rules added, removed, or changed, for every tool whose config lists rules. It also lists tools
with a new pin, rule files that changed, and presets now available for what the repository holds. It is the one
command that asks the network for a newer gspot.

`gspot upgrade` prints the same report as its plan, then asks. On a yes it moves the version
pin, runs `apply` and `install`, and takes the widening step for checks that are new or whose config changed.
It never writes `gspot.toml` and never commits. `--to` moves to an exact version.

## `uninstall`

Removes what gspot wrote: `.gspot/`, the mise file, the managed blocks, the CI job, and the
launcher line. It removes the hook line, or the hooks where gspot wrote them. A task body it
replaced gets its old body back.
It leaves `gspot.toml`. It unsets `core.hooksPath` only where gspot had set it.

## `export`

A profile carries a setup between repositories (D-79, D-161).
[03-configuration.md](03-configuration.md) holds the format.

`gspot export <file>` writes a profile from this repository. It keeps the level, the presets,
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
  on every command that reads the policy, and names the pinned version.
  [11-toolchain.md](11-toolchain.md) has the install paths.
- gspot runs natively on macOS, Linux, and Windows (D-31). A check whose tool has no Windows
  build is a platform skip there.
- gspot sends nothing anywhere. It has no telemetry. It reaches the network in
  `upgrade --dry-run`, in the install of tools, and in checks that declare `network`.
- Every message says what happened and what to do next, in plain words, and names the command.

## Exit codes

| Code | Meaning                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 0    | every check ran and passed, or the command completed                                                                   |
| 1    | findings, a held count that rose, a generated file that drifted, or a missing tool                                     |
| 2    | gspot did not run: unreadable `gspot.toml`, unknown preset, unknown command, unanswered question, version pin mismatch |
