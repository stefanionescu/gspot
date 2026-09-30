# Command Line

This document decides every command, flag, output line, and exit code. Each name is one that
`git`, `cargo`, `ruff`, `biome`, `mise`, or `gh` already has, used the way its source uses it.
A flag exists when a test uses it and a guide shows it, and a command exists when nothing else
answers its question.

## Commands

```text
gspot init       [--yes] [--dry-run] [--from <profile>] [--kits <names...>] [--without <names...>] [--scope <path=names...>]
                 [--hooks gspot|husky|lefthook|pre-commit|simple-git-hooks|existing] [--no-hooks] [--ci github|gitlab] [--no-ci]
                 [--runner mise|npm|pnpm|yarn|bun] [--no-runner]
                 [--no-guides] [--no-checks] [--no-install] [--allow-dirty]
gspot check      [<path>...] [--staged] [--changed[=<ref>]] [--fix] [--dry-run]
                 [--only <checks...>] [--skip <checks...>] [--stage commit|push|manual] [--no-cache]
gspot install    [--dry-run]
gspot apply      [--dry-run]
gspot list       [settings]
gspot explain    <check> | <tool>/<rule> | <kit> | <setting> | <path>
gspot doctor
gspot ignore     <check> [--paths <glob>...] [--rule <rule>] [--reason <text>] [--remove]
gspot set        <setting> [<value>...] [--reason <text>] [--scope <path>] [--replace | --remove | --default]
gspot add        <kit>... [--scope <path>] [--dry-run]
gspot remove     <kit> [--scope <path>] [--dry-run]
gspot uninstall  [--dry-run] [--yes]
gspot export     <file>
gspot completion <bash|zsh|fish|powershell>

global: --help  --version  --json  --quiet  --verbose  --no-color  -C <dir>
env:    NO_COLOR  CI  GSPOT_JOBS  GSPOT_HOOK_* (set by the hooks gspot writes)
        GSPOT_BIN  GSPOT_REGISTRY (both only until the first release)
exit:   0 passed   1 findings   2 gspot did not run
```

A teammate who clones a repository runs one command, `gspot install`. A developer learns three
more first: `gspot check`, `gspot check --changed`, and `gspot check --staged`. Four commands
write one entry of `gspot.toml`: `ignore`, `set`, `add`, and `remove`. Together they cover
every value a finding makes a person change. Four tables are written by hand, because each is
a small structure and no single value: `[[scope]]`, `[[check]]`, `[[naming.contract_properties]]`,
and the elements of `[architecture]`. A hand edit is checked on load like any other.

## Conventions

The checklist is [clig.dev](https://clig.dev/). What it means here:

- Findings go to stdout. Messages about the run, such as progress and hints, go to stderr.
- `-h` and `--help` work on every command, and `--help` gives each flag one plain sentence.
- No color, no spinner, and no question without a terminal. A question that has no flag and no
  terminal is exit 2, and the message names the flag.
- A mistyped command or flag prints the closest match.
- `--dry-run` shows what happens and writes nothing. Every command that changes more than one
  line has it. `ignore` and `set` change one line of a tracked file, and `git diff` shows it.
- A refusal is a `--no-` flag. `--no-checks` installs the guides and no check, and
  `--no-guides` installs the checks and no guide. No flag takes the value `none`.
- A command that deletes prints its plan and asks, and `--yes` answers.
- Every finding ends with a `help:` line, taken from the `help` text of its check.
- A flag means one thing everywhere: `--scope`, `--reason`, `--json`, `--yes`, `--remove`.

## `init`

Reads the repository, proposes a policy, and writes it after a yes.

### What it reads

It reads the files git tracks or is about to track. Without a git repository it walks the
folder, honors `.gitignore`, and says so in the plan. It reads project files such as
`package.json`, `pyproject.toml`, `Package.swift`, an Xcode project, `supabase/config.toml`,
`wrangler.*`, `next.config.*`, `Dockerfile*`, a Compose file, and `nginx.conf`. Every folder
that holds a project file is a scope, as is every workspace member.

It reads the format the
repository has, from Prettier itself, then `.editorconfig`, then Biome. It reads tool
configuration files, to name what init replaces. It reads the hooks, the CI system, the agent
files, and the tasks of the runner.

A language with a project file is proposed from that
file. A language with no project file is proposed from its files. A tool kit is proposed only
where the repository holds the tool.

### What it prints

One line per fact it read: the languages with the file that proposed each, the frameworks,
the scopes, the runner, the hooks and what they call, and the CI system. A `found, not
proposed` list ends it, with the `gspot add` line for each entry.

### The questions

Asked in a terminal, in three groups. Each has a flag that answers it, and `--yes` takes every
plan. The first group asks about the projects found in a monorepo (`--scope`, `--without`) and the
languages, frameworks, tools, and general checks found (`--kits`, `--without`). The second
asks where the gspot line of the hooks goes (`--hooks`, `--no-hooks`) and whether to write a
CI job (`--ci`, `--no-ci`). The third asks whether to install guides (`--no-guides`) and
which task names call gspot (`--runner`, `--no-runner`). The level is not asked: `init` writes `level = "recommended"`.

### The plan

Printed before anything is written, in five groups. `write` holds the policy, `.gspot/`, and
the managed blocks. `change, after your yes` holds task bodies and hook lines. `replaced`
holds each replaced file, with `git show HEAD:<path>` as the way back.

`not written` holds the
lines to paste where gspot writes no CI job. `remove by hand, when ready` holds the developer's
own linters and their plugins. It ends with `Continue? [y/N]`.

A no writes nothing. After the yes, `init` runs `gspot install`. `--no-install` skips it and
prints that one command. `init` runs no check, and its last lines name the three commands a
developer learns, so the developer decides when to lint and when to fix.

### Replacement

gspot replaces a file only when one tool owns it, such as `.eslintrc.json` or `.stylelintrc`.
The plan names every replaced file, the original goes under `.gspot/state/recovery/`, and
`gspot uninstall` puts it back byte for byte. Nothing of the old file is carried into the
policy: the generated configuration is the rule set. A file that several tools read, such as
`pyproject.toml` or `package.json`, is left in place and listed under what the developer
removes by hand. gspot never writes a lint tool, a pin, or a `prepare` script into
`package.json`; the launcher `gspot` is the one package it writes there, under an npm runner.

Hooks a repository has keep running, tracked or local to one clone, and gspot never sets
`core.hooksPath`. Agent files are never read, split, or moved: gspot appends one managed block.

### Refusal

`init` refuses when `gspot.toml` exists, and points at `gspot doctor`. It also refuses, with
exit 2 and nothing written, in five cases. A choice flag holds a value outside its list.
`--kits` or `--without` names a kit that does not exist, and the message names near matches.

`--without` names a kit that a selected kit requires, and the message prints the chain. The
working tree has uncommitted changes and `--allow-dirty` is absent. `--from` names a profile
that does not load.

### Order of writes

`init` validates every flag, the profile, and the proposed `gspot.toml` in memory. It saves
the exact bytes and permissions of every file or task being replaced under
`.gspot/state/recovery/`, and stops there if that fails. It writes the config, generated
files, and managed blocks atomically and resolves tool lockfiles through `apply`. It runs
`gspot install` unless `--no-install` was given. It deletes a replaced original only after its
replacement and recovery entry are complete. A failed resolution leaves existing lockfiles and old
configuration files in place, and the setup report names incomplete steps and the command to
retry.

## `install`

Sets up one clone: the mise tools, the npm tools under `.gspot/node_modules`, the Python tools
under `.gspot/.venv`, and the hooks of this clone. It writes no tracked file and is safe to run
twice. It requires matching managed manifests and lockfiles; missing, stale, or conflicted
locks fail with `Run: gspot apply, then gspot install`.

`init` and the CI job call it. gspot never creates or changes `prepare`, `preinstall`,
`install`, or `postinstall` package scripts. A clone that is not set up says so: `gspot check`,
`gspot doctor`, and a missing tool each print `Run: gspot install`. `check` never installs by
itself.

A missing tool never blocks the setup. `install` runs every step and lists what is left with
the command for each. It exits 2 when a tool gspot installs itself did not install.

## `check`

Runs checks and prints findings. `gspot check` is the truth, and the hooks are the fast path.

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

A changed-file run narrows file-list checks, not the findings of a project-wide check. A
project-wide check runs when a changed, deleted, or renamed path affects its inputs, and every
finding from it counts, including findings in unchanged callers. Nothing records old findings
and nothing is held back. [10-hooks-ci-runners.md](10-hooks-ci-runners.md) defines revision
selection.

A check above the level of the repository is not planned. A check that waits for a setting
prints `skipped` and names the setting. A check whose tool is absent prints `missing` and fails
with the install hint. A check whose file set is empty does not run and does not print. Status
words are lowercase: `ok`, `unchanged`, `fail`, `missing`, `error`, and `skipped`.

Results are cached in `.gspot/cache/`. The key holds the tool version, the config files the
check names, and the content of every file it read. A cached pass prints `unchanged`. Entries
older than 30 days are dropped.

In a folder with no git, `gspot check` runs every check that needs no history; `--staged` and
`--changed` exit 2 there with one sentence that says why. With no upstream, `--changed` uses a
resolvable default branch and says which ref it took; with neither it exits 2 and asks for an
explicit ref. In a shallow clone it names `git fetch --unshallow`.

A wrong line in `gspot.toml` does not stop `check`: the run uses the rest of the config and
reports the line as a finding of `integrity/policy`. A TOML syntax error or unsafe path is exit
2, and invalid security or execution settings are never partially executed.

### Output

A line prints as each check ends: the scope, the check, its status, the file count, and the
time. A finding prints under its check as `file:line:column  rule  message`, a `help:` line,
and one `reproduce:` line with the command that runs that check alone. The end of the run lists
what failed, was missing, or was skipped, and then a summary. A failing run from a hook ends
with `git commit --no-verify` as the way past it. Every run but the message run writes three
files under `.gspot/reports/`: `report.json`, `report.sarif`, and `report.codequality.json`.

The pre-push hook calls `gspot check --push`, a hook-only option that consumes the Git ref
updates on stdin and checks their committed content. The commit message hook calls
`gspot check --stage message --message-file <path>`. `--help` leaves both out.

`--quiet` prints failures only. `--verbose` prints every command and every ignore with its
reason. `--json` prints the report as JSON. Columns are computed from the longest check name.

## `apply`

Writes generated configuration and resolves the tool lockfiles from `gspot.toml`; `--dry-run`
prints the proposed changes and writes nothing. It writes `.gspot/config/*` for each tool,
`.gspot/package.json`, the mise file, approved tracked hook configuration, the CI job, the
managed blocks, and the guides. It deletes obsolete managed output only under the boundary,
ownership-hash, and recovery rules of [03-configuration.md](03-configuration.md). It never
writes `gspot.toml`. It retains matching lockfiles and resolves missing, stale, or conflicted
ones, which can need the network; a failed resolution never replaces a lockfile. It installs no
tools: `gspot install` follows.

`apply` accepts a changed version pin and records the new pin only after every output and lock
applied. Package managers update gspot itself; no upgrade command or migration table exists.
Drift is a check: `integrity/generated-drift` fails a generated file that differs from what the
policy writes.

## `list`

`gspot list` prints what exists and what is on: installed kits, kits found in the repository
and not selected (each with its `gspot add` line), and the rest. Under each installed kit stand
its checks with their state: `on`, `off (level)`, `off (ignore)`, or `waits for <setting>`.
`gspot list settings` prints every setting of the selection, its value, and where the value
comes from.

## `explain`

One verb that says what a thing is. A check name prints `summary`, `why`, `help`, its kit,
level, settings, and the `ignore` line that turns it off. A tool rule prints the summary of
the tool, the page of the rule, and the check that runs it. A kit prints what it detects, its
tools, its checks by stage and level, its settings, and its guides.

A setting prints its
meaning, default, the value in every scope, and the `set` line that changes it. A path prints
the kits that own the file and the checks that read it at each stage. Every text is written
for a person who does not code, and the same text is the page of the manual.

## `doctor`

Prints what is wrong, and what changed in the repository after `init`. It lists each tool with
its state and path, files no check reads, and file kinds with no format, syntax, style, or
type check, with the `gspot add` line. It lists kits detected and not selected, files under
`.gspot/` gspot did not write, and what to remove by hand. It ends with the hook state of this
clone, the CI system, the guide count, the pinned and running versions, and the last full run.
Each line with a remedy ends with its command. `doctor` calls no network and changes nothing.

The hooks line comes from git, not from the config: the hooks run, they exist and this clone
does not run them (the line ends with `gspot install`), or none exist. Exit 0 unless a tool is
missing, outside its accepted version range, or cannot be inspected.

## `ignore`

`gspot ignore <check> --paths "scripts/**" --reason "One launcher script for each environment."`
appends an `[[ignore]]` entry, validates the file, and prints the entry. The reason is
optional unless the repository sets `require_reasons = true`; it is stored with the entry and
printed with `--verbose`. `--rule` narrows to one rule inside the check.

Without `--paths` the entry holds for the whole scope, which is the one way to turn a rule
off, for every tool. An entry with the same check, rule, and reason gains the path. `--remove`
deletes a matching entry. A spelling finding prints the `gspot set tools.typos.words <word>`
line that accepts its word.

One comment form silences a finding of a gspot engine, for every check that engine runs:

```text
// gspot-ignore structure/trivial-function -- The public name is the stable one.
# gspot-ignore naming/identifiers -- Platform API name.
```

A suppression without a reason is a finding, in every comment style gspot reads.

## `add`, `remove`

`gspot add nextjs vitest` appends kits to the root selection, or to a scope with `--scope`. It
runs `apply` and `install`, and runs no check; the checks are on from the next run.
`gspot remove vitest` does the reverse, files included.

## `set`

`gspot set limits.function_lines 80 --reason "Route tables are one ordered list each."` writes
one setting, by the dotted name `gspot list settings` prints. `--scope` targets a scope. An
unknown key fails with the keys that exist under that table. `gspot set extra_checks <check>`
turns on one check above the level, and `gspot set level all` turns on all of them. For a list
the values are appended; `--replace` replaces the list, `--remove` removes the named values,
and `--default` deletes the key. A rule of a tool takes its options or `error` under
`tools.<tool>.rules.<rule>`, and `off` is refused with the `gspot ignore` line that does it.

The four writing commands share one writer. It parses the file with its comments and order
intact, changes one entry, and validates the whole file as load does. It writes the file
through a temporary file and a rename, then runs `apply` and prints the lines it wrote.

## `uninstall`

Removes only recorded, unchanged gspot-owned outputs and its managed blocks, and restores
replaced files and task bodies when the current value still matches what gspot installed. A
developer edit is preserved and reported for manual recovery. It never removes `.gspot/`
recursively: unmarked files, modified outputs, and recovery entries remain, and the command
prints the path of each. It leaves `gspot.toml`.

## `export`

`gspot export <file>` writes a profile from this repository. It keeps the level, the kits,
`extra_checks`, `[limits]`, `[naming]` lists, `[format]`, and `[prose]`. It keeps the options
and the rules of each tool, and the choices for hooks, CI, guides, and runner. It keeps every
`[[ignore]]` that names no path. It leaves out every entry that names a path, and prints each
one.
[03-configuration.md](03-configuration.md) holds the format.

`gspot init --from <profile>` takes a path, an `https` address, or
`github:owner/repo[/path][@ref]`. A remote profile is fetched once, and the plan prints its
SHA-256. Flags given beside `--from` win over the profile.

## Global behavior

`--json` works on every command that prints a report, and each shape is documented. `-C <dir>`
runs as if started in that folder, and every command works from the repository root. The repository pins a gspot version in `.gspot/version`. A gspot of another version exits 2
on every command that reads the policy except `apply` and `uninstall`, and names the pinned
version. [11-toolchain.md](11-toolchain.md) has the install paths.

gspot runs natively on
macOS, Linux, and Windows, and a check whose tool has no Windows build is a platform skip
there. gspot sends nothing anywhere and has no telemetry; it reaches the network in lock
resolution during apply, in the install of tools, and in checks that declare `network`. Every
message says what happened and what to do next, in plain words, and names the command.

## Exit codes

| Code | Meaning                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| 0    | every check ran and passed, or the command completed                                                                |
| 1    | findings, a generated file that drifted, or a missing tool                                                          |
| 2    | gspot did not run: unreadable `gspot.toml`, unknown kit, unknown command, unanswered question, version pin mismatch |
