# Configuration

This document decides the one file a person edits, the files gspot writes, and how settings
merge.

Configuration-document editing owns parsing and field edits for shared JSON, YAML, and TOML.
The lifecycle owner retains locking, observations, journals, publication, and recovery. Static
configuration reading captures the bytes and permissions that authorize adoption; tool-specific
carryover converts those observed settings without acquiring a separate mutation owner. Formatter
and ESLint adoption own their conversion rules; takeover coordinates observations and retirement.

## Ownership boundaries

One lifecycle owner records originals, installed content, modes, later edits, and interrupted
operations for init, apply, remove, and uninstall. Names, headers, and current templates
cannot reconstruct permission to delete. All mutations use the validated path boundary. It checks symlink parents and supported
platform forms. Never remove `.gspot/` recursively.

Generation returns proposals; one application boundary owns collisions, replacement, pruning,
and recovery. Readers and renderers do not apply their own writes. Persistent exceptions use
one policy model; temporary command selection and baselines remain separate concepts. Remove
superseded schemas and readers only after their callers and behavioral contracts move.

Schemas own parsed-input types, defaults, field lists, and reference data. A normalized type
exists only for a real transformation. Use tool-owned configuration resolution where available;
preserve unsupported authored input with an explicit limitation rather than guessing its meaning.

## Files

| Path                                                    | Owner                         | Tracked | Purpose                                                                                                                   |
| ------------------------------------------------------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `gspot.toml`                                            | the repository                | yes     | the config, written by `init` and changed by the four writing commands or by hand                                         |
| `.gspot/<tool-file>`                                    | gspot                         | yes     | the generated configuration of each tool, with the mark of gspot                                                          |
| `.gspot/package.json`, its lockfile                     | gspot                         | yes     | the npm lint tools gspot pins                                                                                             |
| `.gspot/pyproject.toml`, `uv.lock`                      | gspot                         | yes     | the Python lint tools gspot pins                                                                                          |
| `.gspot/node_modules/`, `.gspot/.venv/`                 | gspot                         | no      | where those tools install                                                                                                 |
| `.gspot/version`                                        | gspot                         | yes     | the gspot version this repository runs, one line                                                                          |
| `.gspot/rules/**`                                       | gspot                         | yes     | the installed rule files                                                                                                  |
| `.gspot/state/recovery/**`, `.gspot/state/ownership.json`           | gspot, local recovery data    | no      | exact originals, installed hashes, and completed operations; retained through uninstall                                   |
| `.gspot/cache/**`                                       | gspot                         | no      | verdicts keyed on their inputs, dropped after 30 days                                                                     |
| `.gspot/reports/report.json`, `report.sarif`                    | gspot                         | no      | the last run                                                                                                              |
| `.mise/conf.d/gspot-tools.toml`                         | gspot                         | yes     | tool pins under the mise runner                                                                                           |
| `.editorconfig`                                         | gspot                         | yes     | written whole from `[format]`, because editors read no other place                                                        |
| a root pointer                                          | gspot                         | yes     | for a tool with an include form: a re-export, `extends`, `extend`, or `parent_config`                                     |
| `.gitignore`, `.gitattributes`                          | gspot, one managed block each | yes     | the untracked paths of gspot alone; `.gspot/** linguist-generated` and `.gspot/** text eol=lf`                            |
| `AGENTS.md`, and the agent files the repository holds   | gspot, one managed block each | yes     | the index of rule files: `CLAUDE.md`, `GEMINI.md`, Copilot instructions, a Cursor rule                                    |
| the hook or task a hook calls                           | gspot, one managed block      | yes     | the gspot line: in the hook tool, the task, or the tracked hook file of the repository, or in `.git/hooks/` of each clone |
| `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml` | gspot                         | yes     | the CI job, when enabled                                                                                                  |
| `packages/cli/schemas/gspot.schema.json`                 | gspot                         | yes      | the JSON Schema of `gspot.toml`, published with each release                                                              |

The only shared-manifest writes are the `gspot` launcher and explicitly accepted lint task
entries. gspot never writes tool dependencies or package lifecycle scripts into the developer's
`package.json`, and never writes a table into their `pyproject.toml`.
Existing lifecycle scripts remain byte-for-byte unchanged.

Every generated file opens with a mark:

```text
# Generated by gspot 0.5.0 from gspot.toml. Do not edit.
# Change the config with gspot set or gspot ignore, or edit gspot.toml. Then run: gspot apply
```

A JSON file carries the same text under a `"_gspot"` key. `apply` deletes a file only when it
carries the mark and the config does not write it. A file with no mark is never deleted. Every
file is written through a temporary file and a rename.

## `gspot.toml`

```toml
version = 1
level   = "recommended"           # or "all"
require_reasons = false           # true: every ignore and every loosened setting needs a reason
extra_checks = ["structure/single-file-folder"]   # checks of the level all, turned on one by one

# Folders and files gspot never reads. Files that git ignores are left out already.
exclude = ["legacy", "third_party"]

# The selection. Configurations are bare names.
configurations = ["typescript", "bash", "sql", "supabase", "docker", "markdown"]

# A scope is a folder with a project file and its own selection. Root configurations apply everywhere.
[[scope]]
path    = "api"
configurations = ["typescript", "express", "docker", "nginx", "vitest"]

[scope.limits]
function_lines = { value = 80, reason = "Route tables are one ordered list each." }

[[scope]]
path    = "ios"
configurations = ["swift", "xcode", "xctest"]

# Limits. Only settings a check reads exist. A value may carry a reason.
[limits]
file_lines            = 300
cyclomatic_complexity = 8

[limits.python]
file_lines = { value = 400, reason = "Pydantic models for one API surface live in one module." }

# Naming. Extends the shipped policy. Terms are whole identifier parts.
[naming]
banned_terms = ["dispatcher", "orchestrator"]
allowed      = [{ name = "spawnSync", reason = "Node API name" }]

[naming.swift]
max_chars = { value = 45, reason = "UIKit delegate methods are long by convention." }

[[naming.rules]]
paths = ["api/scripts/steps/*.sh"]
categories = ["files"]
structural_prefix = "^\\d{2}-"

# Architecture. Elements and the imports allowed between them.
[architecture]
types_directory = "types"
elements = [
  { name = "app",      paths = ["src/app"] },
  { name = "modules",  paths = ["src/modules"] },
  { name = "platform", paths = ["src/platform"] },
  { name = "types",    paths = ["types"] },
]
edges_allowed = [
  { from = "app",     to = ["modules", "platform", "types"] },
  { from = "modules", to = ["platform", "types"] },
]

# Options of a tool, under the tool's own words.
[tools.eslint]
rules = { "unicorn/prefer-ternary" = ["error", "only-single-line"] }

[tools.typos]
words = [{ word = "udid", reason = "Apple API name" }]

[tools.commitlint]
scopes = ["api", "ios", "supabase"]

[[tools.licenses.packages_allowed]]
package = "certifi@2025.8.3"
license = "MPL-2.0"
reason  = "The Mozilla Public License covers the certificate bundle, not repository source."

# A check does not apply to these paths. One entry, any number of paths, and a reason if you want one.
[[ignore]]
check  = "structure/single-file-folder"
paths  = ["scripts", "tools/one-off"]
reason = "One launcher script for each environment."

# No paths: the rule is off everywhere in the scope. This is how any rule of any tool is turned off.
[[ignore]]
check  = "bash/shellcheck"
rule   = "SC2312"
reason = "set -e interaction on every correct if-function."

[[ignore]]
check  = "dependencies/osv"
rule   = "GHSA-vwc7-r8mq-g2x9"
reason = "adm-zip symlink overwrite. No fixed release exists."

# What a path is.
[[generated]]
paths = ["api/types/supabase.ts"]

[[vendored]]
paths  = ["vendor"]
reason = "Upstream source, patched only by rebase."

# A script the repository already runs. It joins the run like a configuration check.
[[check]]
name      = "sql/migration-data"
command = ["bunx", "tsx", "supabase/scripts/migrations.ts", "check"]
paths   = ["supabase/migrations/**/*.sql"]       # when it runs
inputs  = ["supabase/migrations/**/*.sql", "supabase/scripts/migrations.ts"]   # what it reads
stage   = "commit"

# Absent table: gspot does nothing there.
[hooks]
tool       = "existing"           # gspot | husky | lefthook | pre-commit | simple-git-hooks | existing
pre_commit = "mise task lint"     # commit-hook invocation location, for "existing"
pre_push   = "mise task lint:push" # push-hook invocation location, for "existing"
push       = "changed"            # selection mode, not a hook location; or "all"

[ci]
provider = "github"               # github | gitlab
run      = "changed"              # or "all": what the CI job checks
sarif    = true                   # upload findings to code scanning, where the repository has it

[runner]
tool  = "mise"                    # mise | npm | pnpm | yarn | bun
tasks = { check = "lint", fix = "lint:fix" }     # the task names that call gspot

[rules]
install   = true
agents    = ["TEAM.md"]                # additional files; supported existing files are detected
directory = ".gspot/rules"
exclude   = []

[coverage]
strict = false                    # true: a source file no check reads fails the run
```

### Rules for the file

- Every setting has a command that writes it, and `gspot list settings` prints the setting name. A hand
  edit gives the same file and is validated on the next load.
- A configuration that does not exist fails to load, with the near matches. A setting no selected
  configuration has fails to load, with the settings that exist under that table.
- A wrong entry does not stop `gspot check`. The run uses the rest of the file and reports the
  entry as a finding of `integrity/policy`. The writing commands and `apply` refuse such a file.
- Unsafe paths and invalid security or execution settings stop the run with exit 2. They are
  never used for partial execution.
- `exclude` lists folders and files that no check reads and `doctor` does not count. `init`
  fills it with each project the developer leaves out.
- A `[[scope]]` path names a folder that exists. Scopes nest, and a file belongs to the deepest
  scope that holds it.
- A selector that names a folder means everything under it: `src`, `src/`, and `src/**` are one
  selector.
- A `reason` is optional on an `[[ignore]]` and on a loosened setting. With
  `require_reasons = true` it is required, and `N/A`, `TBD`, `-`, and an empty string are refused.
  Text fields reject forbidden controls, and every generated value still requires destination-appropriate serialization.
- `[limits.<language>]` and `[naming.<language>]` take the language configuration names. A key there
  wins over the root key for the checks of that language.
- A rule of any tool is turned off by an `[[ignore]]` with `rule`, and nowhere else.
  `[tools.<name>.rules]` holds rule options and rules turned on.
- The `marketing` and `defensive` term groups cannot be removed as groups.
- A `[[check]]` has `name`, `command`, `paths`, `stage`, and optionally `inputs`, `help`, `fix_command`, `fix_order`, `output`,
  `requires`, and `platform`. It is cached only when it names `inputs`. Its `output` takes
  every format a manifest check takes. `help` is explanatory text; `fix_command` is an argument vector and requires `fix_order`, as in a configuration manifest.
- Unknown configuration names fail validation. gspot is unreleased and has no users; update names directly without aliases or version migrations.

### Names of settings

One idea has one word. A list a gspot check skips ends in `_allowed`. One folder ends in
`_directory`. A list of file globs ends in `_files`. The option of a tool keeps the word of the
tool. [public vocabulary](README.md#glossary) holds the table, and a test over the manifests holds it.

### Architecture

`[architecture]` is read by the boundaries rules and the types rules, at the level `all`. It has
five keys: `types_directory`, `elements`, `edges_allowed`, `roles`, and `contracts`. `roles`
names the files that own the config, the environment, and the test support. `contracts` holds
the import contracts of a Python project. An element imports only itself
unless a row of `edges_allowed` adds a target. No default names a folder: a rule with nothing
configured reports nothing.

`init` proposes `types_directory` from what exists.

### Options of a tool

`[tools.<name>]` holds the options a person changes on that tool, under the tool's own names. A
person who knows ESLint writes `rules = { ... }`, and a person who knows Prettier writes
`printWidth`. An option the configuration does not have fails to load and names the ones that exist.

A tool is turned off by ignoring its checks, and a tool whose every check is ignored whole is
not installed. Every tool has `[tools.<name>.extra]`: a table written as it stands into the config of the
tool, with a required `reason`, for an option the configuration does not have yet. Every `extra` table
prints with `--verbose`. A key in `extra` that the configuration has fails to load and names it.

A setting may be detected. `init` fills it from the repository, such as the build command, the
output folder, the SQL dialect, or the Swift destination, and asks where it finds nothing.

## Profiles

A profile is a TOML file with the schema of `gspot.toml` and three differences:

| Difference | Rule                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Head       | `profile = "<name>"` and `selection = "exact"` or `"detect"` stand beside `version`, `level`, and `configurations`                                |
| Left out   | `[[scope]]`, `[[generated]]`, `[[vendored]]`, `[[check]]`, and any entry with `paths` are refused. An `[[ignore]]` with no `paths` travels |
| Reasons    | a loosened setting keeps its reason, and the reason travels with the profile                                                               |

`selection = "exact"` installs the named configurations and what they require. Detection still runs,
and the plan lists what it found and did not install. `selection = "detect"` adds the detected
configurations to the named ones. A profile is read through the same schema as the config, so a value
it carries is held to the same rules.

```toml
version   = 1
level     = "all"
profile   = "house-style"
selection = "exact"
configurations   = ["typescript", "formatting", "spelling", "markdown", "commits"]

[format]
indent_width = 2

[hooks]
tool = "lefthook"
```

`init --from` copies the tables of the profile into the new `gspot.toml`. The repository does
not point back at the profile, so the config stays one file. Rejected: an `extends` key, which
makes every run depend on a second file and, for an address, on the network.

## Merge order

For every setting:

```text
configuration default
  → framework or platform configuration, in selection order
  → root table
  → scope table
```

Lists append and drop repeats. Scalars replace. Two configurations that set one scalar to two values
fail at load with both configurations named, and a root value settles it.

## An old repository

gspot records no old findings, and installing it runs no check. `gspot check` reports
what it finds today. An old repository adopts gspot through four things that need no record:

- File-list checks run on changed files; affected whole-project checks keep all findings, including existing errors and errors in unchanged callers.
- The level `recommended` holds defect checks. Banned-term checks run at `all`.
- `gspot ignore` turns a check or a rule off. It works for the whole repository or for some paths.
- `git commit --no-verify` passes a hook, and a failing run names it.

## What a path is

Every tracked path is one of four kinds: source, generated, vendored, or binary. The sources
are `[[generated]]` and `[[vendored]]`, `.gitattributes`, a banner the configuration knows, and the
first bytes of the file, in that order.

| Kind      | Checks that apply                                          |
| --------- | ---------------------------------------------------------- |
| source    | everything the selected configurations claim for its kind of file |
| generated | secrets                                                    |
| vendored  | secrets, licenses, security                                |
| binary    | secrets, and the size limit unless the file is under LFS   |

A source file that no check reads is unchecked, and `doctor` lists it. With
`[coverage] strict = true` it fails `check`. A kind of file that gets no format, syntax, style,
or type check is named by `doctor` and by `gspot list`.

## Path selectors

One syntax everywhere: globs from the root, `**` crosses folders, and `!` negates after an
include. A folder name means everything under it. gspot never translates its own selectors into
the ignore syntax of a tool: it passes file lists. Selectors use forward slashes on every
platform.

## Path and ownership boundaries

Every scope, rule output, generated target, and deletion target is relative to the config root.
Reject absolute paths, drive-relative paths, Universal Naming Convention (UNC) paths, parent traversal, and canonical paths
outside that root. Validate existing ancestors of a new output before creating it. A source
symlink that leaves the root is reported and not followed. Managed output paths cannot traverse
symlinks, including a symlinked `.gspot/`.

Use standard filesystem APIs. Validate paths and existing parents before mutations; reject
symlinks and path escapes. Preserve original bytes, modes, ownership, and interrupted recovery.
Hostile concurrent directory replacement is outside this filesystem contract.
Tests cover case-insensitive filesystems, both path separators, spaces, and Windows drive forms.

Git integration is the one separate boundary: hooks use the path Git resolves for that clone,
including linked worktrees and `core.hooksPath`. The hook installer validates that resolved
location independently. A config below the Git root does not authorize other writes above the
config root. Tools can read dependencies outside the root where the repository declares them;
that grants no write or deletion authority. This is not a sandbox for arbitrary repository
commands.

Before replacing a developer file or task, save its exact bytes, mode, original path, and hash
under `.gspot/state/recovery/<operation>/`. Recovery directories and metadata are owner-only because originals can contain credentials; backup content never appears in reports or CI artifacts. Store the installed hash and ownership kind in
`.gspot/state/ownership.json`. Recovery is local, untracked, and required even with Git or
`--allow-dirty`. It is never treated as a cache or removed by cache eviction or uninstall.

If recovery cannot be written, refuse that replacement. A second operation never overwrites an
earlier original. A fresh clone has no local ownership or original backups. Preserve its
unrecorded files, including tracked files that match generated templates. Applying an identical
proposal records the existing bytes and mode as the original, so later removal restores them.

`apply`, `remove`, and uninstall delete only outputs with a local ownership record whose
bytes and mode still match the recorded installed value. Names, marks, Git tracking, and
reproduction from the pinned configuration do not authorize deletion. Modified outputs are
retained and reported until the user restores or moves them.

Uninstall uses the same rule and removes only empty owned directories. Restoring an original
requires an absent destination or an unchanged gspot-installed value. Otherwise, preserve both
versions and print their paths. Interrupted operations resume from the ownership record;
serialize mutations with one lock per config root, and refuse a concurrent writer.

## Carrying configuration

Load flat ESLint configuration through the repository's native ESLint API. Preserve ordered
`files`, `ignores`, rule options and severities, language options, settings, plugins, and
parsers in `tools.eslint.adopted`. Keep selectors as selectors so they govern future files.
Repository-owned executable rules remain imported code registered by module and export.
Never serialize an executable rule into TOML. Unsupported legacy configuration, processors,
inline executable selectors, and unregistered implementations fail conversion and leave the
original configuration intact. Validate effective configurations with ESLint before adoption.

Use Prettier's native loader for executable root configurations and format parsers for static
configuration. Shared base options belong in `[format]`; ordered native overrides belong in
`tools.prettier.extra.overrides`, including `files`, `excludeFiles`, and options. Preserve native
ignore lines, including negations, in `tools.prettier.ignore_patterns`. These selectors apply to
future files without consulting the current filename inventory. Shared format overrides emit
EditorConfig sections only when that syntax can represent their selectors; otherwise fail with
the exact selector and direct the user to native tool configuration. Unsupported EditorConfig,
nested formatter configuration, and JSON5 inputs currently fail conversion before replacement.
Package metadata remains intact when its formatter settings are adopted.

Validate value types at input and serialize each value for its output language. Quote TOML
keys and strings, serialize JSON and JavaScript data, and escape comments for their delimiter.
One line of printable text is not a substitute for escaping. Reject control characters where
the field contract prohibits them; accept legitimate quotes, backslashes, and Unicode through
the proper serializer. Remote profiles use the same validation and emission path.

## Tool lockfiles

`apply` owns resolution and tracked tool lockfile changes. It resolves only when manifests and
locks differ or a lock is absent or conflicted. Resolution happens in an isolated temporary
project; validated lockfiles replace the originals atomically. A failed resolver leaves old
locks in place and reports the unresolved tool set. `--dry-run` publishes none of those files.

`install` requires matching manifests and locks. It uses `npm ci`,
`pnpm install --frozen-lockfile`, `bun install --frozen-lockfile`,
`yarn install --frozen-lockfile` for Yarn Classic, or `yarn install --immutable` for Berry.
Python uses `uv sync --locked --project .gspot`; [uv documents locked synchronization](https://docs.astral.sh/uv/concepts/projects/sync/).
Use the isolated-project and registry handling of K-267 for every command.
Missing or stale locks fail setup with `Run: gspot apply, then gspot install`.

`init`, `add`, and `remove` call `apply` before `install`.
A setting change calls `apply`; if dependencies change, its output names `gspot install`.
After a merge, resolve `gspot.toml`, run `apply` to rebuild conflicted outputs and locks, then
run `install`. No automatic package lifecycle script calls any of these commands.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-298

Confine reads, outputs, and deletions under the boundary contract in [03-configuration.md](03-configuration.md).

Use one path validator for lexical and canonical boundaries, validate existing ancestors, reject output symlinks and Windows escape forms, and revalidate immediately before mutations. Git-resolved hooks have a separately validated boundary.

Scope `..`, rules `../outside-rules`, absolute paths, Universal Naming Convention (UNC)
paths, drive-relative paths, both separators, symlinked parents, symlink replacement, case
variants, and a config below the Git root. Assert no external file is changed.

### Acceptance K-299

Use the recovery and ownership rules of [03-configuration.md](03-configuration.md) for init, apply, remove, and uninstall.

Save original bytes and mode before replacement, record installed hashes, serialize writers, resume interrupted operations, and restore only absent or unchanged destinations. Preserve unowned files, subsequent developer edits, and local recovery. Keep ignore entries while recovery remains.

No Git, unborn Git, untracked config, dirty takeover, second replacement, full disk before backup, interrupted replacement, edited tasks, fresh clone with no original backup, unmarked and modified marked files under `.gspot/`.

### Acceptance K-217

gspot never writes a lint tool into a manifest of the developer. The npm tools and
libraries a configuration pins install into `.gspot/node_modules`, from a generated `.gspot/package.json`
and its lockfile. Every check runs the binary under `.gspot/`. The ESLint of the developer, its
config, and its plugins stay, and takeover lists them for removal by hand.

`tool-packages.ts` collects every tool with an `npm` name from the selected manifests,
with its pinned version, and writes `.gspot/package.json` with the mark `_gspot`. `install-tools.ts`
runs the install of the package manager the repository uses, with `.gspot/` as its folder,
through `nypm`. The lockfile under `.gspot/` is tracked, and `.gspot/node_modules/` is in the
managed `.gitignore` block. `tool-probe.ts` looks under `.gspot/node_modules/.bin` first and never
under the `node_modules` of the root.

The generated ESLint config sits in `.gspot/`, so its
imports resolve there with no setting. `typescript/tsc` keeps the TypeScript of the repository,
because it answers for the build the developer ships. `manifest-policy` and `doctor` call a lint
package the developer still holds a thing to remove by hand, never a duplicate pin. A mise
install never lists an npm library as an `npm:` tool.

A planted repository on ESLint 8 with a plugin of its own holds an unchanged
`package.json` and lockfile after `init --yes`, and `typescript/eslint` runs ESLint 9 from
`.gspot/`. The same case with ESLint 10. A scope with its own install passes its ESLint check.

### Acceptance K-267

The install under `.gspot/` works behind a private registry, inside a workspace, and
under each of the four package managers.

The function asks the package manager for the registry settings at the root, through
`npm config list --json` and its matches. It passes them to the install as environment values,
so no token is written to a file.

It installs with the flag that keeps a project apart:
`--ignore-workspace` for pnpm, and a separate project with its own `.yarnrc.yml` and real resolved `yarn.lock` for Yarn Berry. Project isolation is prepared by `apply`, not by creating or rewriting a lock during `install`. The lockfile under `.gspot/` belongs to the selected managed package manager and its recorded version. Resolution and immutable installation follow [03-configuration.md](03-configuration.md); registry credentials never enter logs, plans, tracked files, or recovery output.

One planted case for each package manager, and one with a registry that needs a
token, served by the harness registry.

### Acceptance K-268

The plan tells the developer the one ignore line for each such tool, and gspot never
reports its own folder to them twice.

A takeover row takes `ignore_hint`, the line that tool needs, such as `.gspot/` for
`.prettierignore` or `"ignorePaths": [".gspot/**"]` for Renovate. The plan prints the hints of
the tools it found under removal by hand. The checks of gspot skip `.gspot/node_modules` and
`.gspot/.venv`. `dependencies/osv` reports an advisory in a lockfile of gspot apart from the
others, with `gspot apply` as its fix.

A planted repository with Renovate and Prettier of its own holds both hints in the
plan.

### Acceptance A-5

`gspot.local.toml` is gone, and no file skips a check on one machine. `init`
runs no check, and its last lines name `gspot check` and `gspot check --fix`.

`read-policy.ts` reads `gspot.toml` alone. `plan.ts` loses the local skip list and
keeps `--skip`. A `gspot.local.toml` that still exists is named once by `doctor` as a file
nothing reads.

A planted `gspot.local.toml` that skips `bash/shellcheck` changes nothing: the check
runs.

### Acceptance K-72

One managed block in `.gitattributes`: `.gspot/** linguist-generated`.

The block uses the `#` comment markers, as the `.gitignore` block does. `uninstall`
removes it, and deletes the file when the block was all it held.

The planted install holds the block, and `uninstall.test.ts` holds that it is gone.

### Acceptance K-118

`init`, `apply`, `remove`, and `uninstall` share the ownership and recovery contract in [03-configuration.md](03-configuration.md). Unowned files and developer-modified owned files survive. Uninstall never recursively removes `.gspot/`.

Marks identify candidate managed files, but deletion also checks the locally recorded installed hash, path confinement, and completed recovery. Fresh clones preserve unrecorded files even when they match generated templates. Modified files are reported, not discarded. The path prefix test goes. The gitleaks baseline moves to the root of the
repository as `.gitleaks-baseline.json`, a file the developer owns, and the secrets manifest
names that path.

A planted repository with a hand-made JSON file under `.gspot/` holds the file after
`apply`, `remove`, and `uninstall`, and a line for it in `doctor`. A modified marked file, a no-git takeover, an unborn repository, and a dirty task replacement all preserve the developer's bytes.

### Acceptance K-296

The block holds the untracked paths of gspot alone, and it comes from the
manifests. gspot creates the file where none exists and adds no line for the files of the
developer.

The fixed lines are `.gspot/cache/`, `.gspot/node_modules/`,
`.gspot/.venv/`, `.gspot/reports/report.*`, `.gspot/state/recovery/`, and `.gspot/state/ownership.json`. A manifest adds a line through a field named
`untracked`, and the prose manifest names the folder of each Vale package there. The block goes
at the end of the file. In a folder with no git, `targets.ts` leaves the block out. `uninstall`
removes the block only when no retained recovery or local state still needs its ignore entries, and deletes the file only when the block was all it held.

Three planted cases: no `.gitignore`, one with lines of the developer, and a folder
with no git. `uninstall.test.ts` holds that a file gspot created is deleted.

### Acceptance K-51

The policy holds no line over 120 characters. A scope is `[[scope]]` with sub-tables
`[scope.limits]` and `[scope.tools.<name>]`. One `[[ignore]]` holds one reason and a list of
paths.

`propose.ts` builds the document as sub-tables through `TomlDocument`. `write.ts`
appends to the sub-table when it exists and creates it when not. `ignore-command.ts` adds a path
to an entry with the same check, rule, and reason, and creates an entry only for a new reason.

A unit test writes a scope setting into a document of each form and loads the result.
The proposal snapshot holds no line over 120 characters.

### Acceptance K-88

A selector that names a folder means everything under it. Scopes nest, and a file
belongs to the deepest scope that holds it.

`normalize.ts` turns `src` and `src/` into `src/**` where the path is a folder of the
repository. `scopes.ts` sorts scopes by depth and assigns each file once.

Unit tests for the three spellings, and for a file under a nested scope.

### Acceptance K-89

A message says setting, configuration, scope, and default, the words of
[03-configuration.md](03-configuration.md).

`PolicyScopeLayer` becomes `ScopeSettings`. The settings list prints three columns:
the key, its value, and where the value comes from. The message that says no selected configuration `exposes` a key says that no
selected configuration has the setting.

The message unit tests, and a test that no message function returns one of the words.

### Acceptance K-116

One output schema, used by manifests and by `[[check]]`.

`policy/schema.ts` imports the output schema of the manifest.

A config test repository with `format = "json"` loads.

### Acceptance K-215

The public names contract: a skipped list ends in `_allowed`, one folder in `_directory`, a
list of globs in `_files`. A rule of any tool is turned off through `[[ignore]]` alone.

Renames only, each in one commit with its readers, its tests, and its row of
[public vocabulary](README.md#glossary). The check becomes `xcode/asset-catalogs`. The Semgrep rule names of
the bash pack start with `gspot.bash.`. `docs/readme-present` asks for a license file at the
level `all` alone.

A unit test over the manifests fails a setting name whose last part is outside the
table.

### Acceptance K-222

One value, `format.indent_width`, for every tool that indents.

The YAML block leaves the template.

Generate configuration at both levels and exercise indentation through each pinned formatter
(T-36). Verify the configured value, the resulting bytes, and preservation of scoped overrides.

### Acceptance K-48

`init` proposes a scope for every folder that holds a project file: `package.json`,
`pyproject.toml`, `Package.swift`, an Xcode project, or `supabase/config.toml`. Every
file of a scope sits under `.gspot/<scope>/`.

The project file names come from `project_files` of the manifests (K-182), so the
scope reader names no configuration. `scopeFile(scope, name)` is the one function that builds a path of
a scope file.

`init --yes` on a planted copy of the app layout proposes the three scopes with no
`--scope` flag.

### Acceptance K-269

This table, held in the manifests by a `pointer` key, and tested for each row:

| Tool                                                                                        | Root pointer                                                      | Form                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Prettier                                                                                    | `prettier.config.mjs`                                             | re-export                                           |
| commitlint                                                                                  | `commitlint.config.mjs`                                           | re-export                                           |
| ESLint                                                                                      | none where the developer keeps a config; else `eslint.config.mjs` | re-export                                           |
| stylelint                                                                                   | `.stylelintrc.json`                                               | `extends`                                           |
| markdownlint-cli2                                                                           | `.markdownlint-cli2.jsonc`                                        | `config.extends`                                    |
| yamllint                                                                                    | `.yamllint.yml`                                                   | `extends`                                           |
| Ruff                                                                                        | `ruff.toml`                                                       | `extend`                                            |
| basedpyright                                                                                | `pyrightconfig.json`                                              | `extends`                                           |
| SwiftLint                                                                                   | `.swiftlint.yml`                                                  | `parent_config`                                     |
| gitleaks                                                                                    | `.gitleaks.toml`                                                  | `[extend] path`                                     |
| EditorConfig                                                                                | `.editorconfig`, the file itself                                  | written from format and overrides, only if lossless |
| ShellCheck, shfmt, SwiftFormat, sqlfluff, hadolint, typos, taplo, osv-scanner, v8r, Semgrep | none                                                              | the check passes the path by flag                   |

A config in a manifest takes `pointer = { path, form }`. `pointers.ts` writes one
small file for each, with the mark. A pointer is never written over a file the developer keeps.

An existing `.editorconfig` is replaced only after its full behavior is represented. Unsupported section conversion currently fails adoption and preserves the original. Prettier base options and native selectors use the configuration owners described above. Saved recovery precedes any accepted replacement.

It leaves the shared-file list of
K-36. The guide on editors names, for each tool with no pointer, the editor setting that reads
`.gspot/`.

Verify emitted pointers through their native consumers (T-36). A planted case formats a file
through the root pointer of Prettier and through `gspot check --fix`, and requires equal bytes.

### Acceptance K-274

The generated files are outputs. After a merge of `gspot.toml`, `gspot apply` writes
each of them again, and `gspot apply` resolves the lockfile in temporary storage and replaces it only on success. Review and commit those changes; `gspot install` then installs the recorded contents without writing tracked files.

A conflict marker in a file under `.gspot/` is one finding that names those two
commands, in place of a parse error for each tool.

A planted merge of two `gspot set` branches holds the finding, then a clean run after
the two commands.

### Acceptance K-36

Takeover deletes a file only when one tool owns it. A shared file is read,
its section is carried, and the plan names the section for the developer to remove.

A takeover row of a manifest has `file` and `shared = true` or no such key.
`deleteReplaced` skips a shared row, and `noLongerRuns` prints its section name.

`takeover.test.ts` plants a `setup.cfg` with `[flake8]` and `[sqlfluff]`, and holds
that the file is there after `init --yes`.

### Acceptance K-257

A file gspot writes is whole or untouched. A run whose cache or report cannot be
written still prints its findings and keeps its exit code.

`writeWhole(path, text)` writes `<path>.<pid>.tmp` in the same folder, then renames
it, and removes the temporary file when the write throws. `writeCached` and `writeRecord` catch
the error and print one line on stderr: the path and the system message. `execute.ts` sets the
exit code from the findings before it writes the record.

A unit test makes the rename fail and holds that the old file is whole. A planted run
with a read-only `.gspot/` holds exit 1, the findings on stdout, and one line on stderr.

### Acceptance K-108

A missing table means gspot does nothing there, for all three.

`Policy['hooks']` is optional. `init` writes the table it chose, so a config written
by `init` is explicit. The value `"none"` leaves the three enums.

A unit test holds that `apply` on a config with no `[hooks]` table leaves
`core.hooksPath` unset.

### Acceptance K-109

gspot writes a script only where the name is free, and never writes `prepare`. Where
`lint`, `format`, or `check` exists, the plan proposes a new body and the developer accepts it
. The developer runs `gspot install` explicitly; no setup or lifecycle script is injected.

`writePackages` takes the accepted names from the policy, `[runner] tasks`. A name
that exists and was not accepted is skipped and printed.

A planted install with `"prepare": "husky"` holds that the line is unchanged.

### Acceptance K-147

`check` runs with the rest of the config and reports the wrong line as a finding of
`integrity/policy`. The finding carries the file and the line. A TOML syntax error still stops the run, because no rest
exists.

`readPolicy` returns the policy and its problems. A problem drops its own entry or key
and keeps the others. The edit commands and `apply` still refuse a config with problems, because
they write from it.

A planted config with an `[[ignore]]` that lacks a reason holds one finding, and the
other checks run.

### Acceptance K-238

Every emitted string, key, path, and comment uses destination-appropriate serialization under [03-configuration.md](03-configuration.md).

Validate the semantic value, then encode it for TOML, JSON, JavaScript, shell arguments, or the relevant comment grammar. Use format writers where available. Never interpolate raw values into executable source or rely on a shared printable-text validator as escaping. Profiles use the same validators and writers.

Parse every generated format after inputs containing quotes, backslashes, comment delimiters, Unicode, and rejected controls. Assert the parsed value equals the intended value and no additional setting or statement appears. Run the same cases through a profile.

### Acceptance K-193

Takeover carries a rule in both directions, with the paths it held for. A rule turned
off becomes an `[[ignore]]` with `rule` and `paths`. A rule turned on, with its options, becomes
an entry of `tools.<tool>.rules`, or a path-specific override when applicability differs. The plan lists, for each replaced file, every setting that was
not carried.

A flat ESLint config is a module, so gspot loads it through ESLint itself.
Resolve the config for every governed file using the repository's installed ESLint. Group equal
configurations and preserve path-specific differences in `[[tools.eslint.overrides]]`.

Compare against proposed output for those same paths. An extension is not a configuration class.
Preserve enabled rules, options, disabled rules, and ignores.

Unsupported plugins, processors, dynamic selectors, or options keep the original file active.
A warning alone is not permission to delete it. New-file applicability and ordering follow
[03-configuration.md](03-configuration.md). An `.eslintrc` file is read the same way. `disabledFromRulesTable` stays for
markdownlint and stylelint, whose files are plain JSON.

`takeover.test.ts` plants a config with `no-var: error`, a rule off for `tests/**`, and
a plugin gspot does not ship. It holds separate source, test, and package overrides; the unsupported plugin keeps its original configuration active and out of the deletion plan.

### Acceptance K-120

`init` learns the format the repository has, and proposes it.

Use the native Prettier API and format parsers to preserve base options and ordered override
selectors as described above. Exercise files created after adoption. Unsupported constructs
produce a specific conversion failure, leave original bytes intact, and prevent successful
adoption; they never become a sampled filename list or a global approximation.

`takeover.test.ts` plants each of the five forms with tabs, and holds
`indent_style = "tab"` in the written config.

### Acceptance K-126

A dependency is found in every manifest form a Python repository uses.

The reader adds `[tool.poetry.dependencies]`, `[tool.poetry.group.*.dependencies]`,
`requirements*.txt` by line, and `[packages]` of `Pipfile`. Names are compared after PEP 503
normalization.

Unit tests with one test repository for each form, each naming `FastAPI` in another spelling.

### Acceptance K-128

Both endings carry their own tag and the tag `source`.

Two table rows. `.kt` and `.java` stay unknown, because no configuration reads them, and
detection names their language through `linguist-languages`.

A unit test of `repository/tags.ts` for both endings.

### Acceptance K-76

One reader knows every task of a repository, and one check holds the gspot line of
the hooks for every hook form.

`readers/tasks.ts` returns the task names from mise tables, mise task files, and
`package.json` scripts, for a scope. `task-policy` finds the hook through
`emit/hook-managers.ts`, the same code that wrote the line, and fails when the line is gone.

A planted README that names a file task holds no finding. A husky repository with the
gspot line removed holds one.

### Acceptance K-237

A lint package is a package that a tool of a selected configuration names.

The list is built from the `npm` and `pypi` names of every manifest tool, plus the
`replaces` names a manifest gives, such as `eslint-config-*` for the javascript configuration.

`takeover.test.ts` plants a `package.json` with `husky` and `concurrently` alone, and
holds that the plan does not name it.

## Adoption and preservation

Support empty repositories, repositories without Git, existing lint setups, and mixed-language
projects. Before takeover, classify existing configuration and tasks as carried, replaced,
retained, or developer cleanup. Shared manifests and product data remain authored content.
Unsupported options or path applicability keep their source configuration active. Recovery
must exist before replacement; Git tracking alone does not establish recoverability.

Compare old and replacement enforcement before removing an old check. Keep task names the team
uses, preserve unrelated task bodies and user hooks, and list lint-only dependencies, workspaces,
and duplicate pins for explicit cleanup. Do not delete an entire tooling or rules folder on
its name alone. A committed generated bundle remains declared generated output; host-loaded
frontend code can set its runtime explicitly. Portable choices travel through export and
init --from, without a permanent link to the source profile.
