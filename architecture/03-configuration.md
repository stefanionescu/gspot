# Configuration

This document decides the one file a person edits, the files gspot writes, and how settings
merge.

## Files

| Path                                                    | Owner                         | Tracked | Purpose                                                                                                                           |
| ------------------------------------------------------- | ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `gspot.toml`                                            | the repository                | yes     | the config, written by `init` and changed by the four writing commands or by hand                                                 |
| `.gspot/<tool-file>`                                    | gspot                         | yes     | the generated configuration of each tool, with the mark of gspot                                                                  |
| `.gspot/package.json`, its lockfile                     | gspot                         | yes     | the npm lint tools gspot pins (D-145)                                                                                             |
| `.gspot/pyproject.toml`, `uv.lock`                      | gspot                         | yes     | the Python lint tools gspot pins (D-157)                                                                                          |
| `.gspot/node_modules/`, `.gspot/.venv/`                 | gspot                         | no      | where those tools install                                                                                                         |
| `.gspot/version`                                        | gspot                         | yes     | the gspot version this repository runs, one line                                                                                  |
| `.gspot/rules/**`                                       | gspot                         | yes     | the installed rule files                                                                                                          |
| `.gspot/recovery/**`, `.gspot/ownership.json`           | gspot, local recovery data    | no      | exact originals, installed hashes, and completed operations; retained through uninstall                                           |
| `.gspot/cache/**`                                       | gspot                         | no      | verdicts keyed on their inputs, dropped after 30 days                                                                             |
| `.gspot/report.json`, `report.sarif`                    | gspot                         | no      | the last run                                                                                                                      |
| `.mise/conf.d/gspot-tools.toml`                         | gspot                         | yes     | tool pins under the mise runner (D-127)                                                                                           |
| `.editorconfig`                                         | gspot                         | yes     | written whole from `[format]`, because editors read no other place                                                                |
| a root pointer                                          | gspot                         | yes     | for a tool with an include form: a re-export, `extends`, `extend`, or `parent_config` (D-100)                                     |
| `.gitignore`, `.gitattributes`                          | gspot, one managed block each | yes     | the untracked paths of gspot alone (D-170); `.gspot/** linguist-generated` and `.gspot/** text eol=lf`                            |
| `AGENTS.md`, and the agent files the repository holds   | gspot, one managed block each | yes     | the index of rule files: `CLAUDE.md`, `GEMINI.md`, Copilot instructions, a Cursor rule                                            |
| the hook or task a hook calls                           | gspot, one managed block      | yes     | the gspot line: in the hook tool, the task, or the tracked hook file of the repository, or in `.git/hooks/` of each clone (D-167) |
| `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml` | gspot                         | yes     | the CI job, when enabled (D-133)                                                                                                  |
| `gspot.schema.json`                                     | gspot                         | no      | the JSON Schema of `gspot.toml`, published with each release                                                                      |

The only shared-manifest writes are the `gspot` launcher and explicitly accepted lint task
entries. gspot never writes tool dependencies or package lifecycle scripts into the developer's
`package.json`, and never writes a table into their `pyproject.toml`.
Existing lifecycle scripts remain byte-for-byte unchanged (D-175).

Every generated file opens with a mark:

```text
# Generated by gspot 0.5.0 from gspot.toml. Do not edit.
# Change the config with gspot set or gspot ignore, or edit gspot.toml. Then run: gspot apply
```

A JSON file carries the same text under a `"_gspot"` key. `apply` deletes a file only when it
carries the mark and the config does not write it. A file with no mark is never deleted. Every
file is written through a temporary file and a rename (D-152).

## `gspot.toml`

```toml
version = 1
level   = "recommended"           # or "all" (D-119)
require_reasons = false           # true: every ignore and every loosened setting needs a reason (D-164)
extra_checks = ["structure/single-file-folder"]   # checks of the level all, turned on one by one (D-160)

# Folders and files gspot never reads. Files that git ignores are left out already.
exclude = ["legacy", "third_party"]

# The selection. Presets are bare names.
presets = ["typescript", "bash", "sql", "supabase", "docker", "markdown"]

# A scope is a folder with a project file and its own selection. Root presets apply everywhere.
[[scope]]
path    = "api"
presets = ["typescript", "express", "docker", "nginx", "vitest"]

[scope.limits]
function_lines = { value = 80, reason = "Route tables are one ordered list each." }

[[scope]]
path    = "ios"
presets = ["swift", "xcode", "xctest"]

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

# A script the repository already runs. It joins the run like a preset check.
[[check]]
name      = "sql/migration-data"
command = ["bunx", "tsx", "supabase/scripts/migrations.ts", "check"]
paths   = ["supabase/migrations/**/*.sql"]       # when it runs
inputs  = ["supabase/migrations/**/*.sql", "supabase/scripts/migrations.ts"]   # what it reads
stage   = "commit"

# Absent table: gspot does nothing there (D-130).
[hooks]
tool       = "existing"           # gspot | husky | lefthook | pre-commit | simple-git-hooks | existing
pre_commit = "mise task lint"     # commit-hook invocation location, for "existing"
pre_push   = "mise task lint:push" # push-hook invocation location, for "existing"
push       = "changed"            # selection mode, not a hook location; or "all" (D-123)

[ci]
provider = "github"               # github | gitlab
run      = "changed"              # or "all": what the CI job checks (D-165)
sarif    = true                   # upload findings to code scanning, where the repository has it

[runner]
tool  = "mise"                    # mise | npm | pnpm | yarn | bun
tasks = { check = "lint", fix = "lint:fix" }     # the task names that call gspot (D-116)

[rules]
install   = true
agents    = ["AGENTS.md", "CLAUDE.md"]   # detected from what the repository holds
directory = ".gspot/rules"
exclude   = []

[coverage]
strict = false                    # true: a source file no check reads fails the run
```

### Rules for the file

- Every setting has a command that writes it, and `gspot list settings` prints the setting name. A hand
  edit gives the same file and is validated on the next load.
- A preset that does not exist fails to load, with the near matches. A setting no selected
  preset has fails to load, with the settings that exist under that table.
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
- A `reason` is optional on an `[[ignore]]` and on a loosened setting (D-164). With
  `require_reasons = true` it is required, and `N/A`, `TBD`, `-`, and an empty string are refused.
  Text fields reject forbidden controls, and every generated value still requires destination-appropriate serialization.
- `[limits.<language>]` and `[naming.<language>]` take the language preset names. A key there
  wins over the root key for the checks of that language.
- A rule of any tool is turned off by an `[[ignore]]` with `rule`, and nowhere else (D-144).
  `[tools.<name>.rules]` holds rule options and rules turned on.
- The `marketing` and `defensive` term groups cannot be removed as groups.
- A `[[check]]` has `name`, `command`, `paths`, `stage`, and optionally `inputs`, `help`, `fix_command`, `fix_order`, `output`,
  `requires`, and `platform`. It is cached only when it names `inputs` (D-155). Its `output` takes
  every format a manifest check takes. `help` is explanatory text; `fix_command` is an argument vector and requires `fix_order`, as in a preset manifest.
- A key gspot does not know fails normal validation. Before the first release an old name is unknown (D-134); after release only `upgrade` applies versioned migrations before target validation (D-159).

### Names of settings

One idea has one word (D-144). A list a gspot check skips ends in `_allowed`. One folder ends in
`_directory`. A list of file globs ends in `_files`. The option of a tool keeps the word of the
tool. [19-names.md](19-names.md) holds the table, and a test over the manifests holds it.

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
`printWidth`. An option the preset does not have fails to load and names the ones that exist.

A tool is turned off by ignoring its checks, and a tool whose every check is ignored whole is
not installed (D-160). Every tool has `[tools.<name>.extra]`: a table written as it stands into the config of the
tool, with a required `reason`, for an option the preset does not have yet. Every `extra` table
prints with `--verbose`. A key in `extra` that the preset has fails to load and names it.

A setting may be detected. `init` fills it from the repository, such as the build command, the
output folder, the SQL dialect, or the Swift destination, and asks where it finds nothing.

## Profiles

A profile is a TOML file with the schema of `gspot.toml` and three differences (D-79):

| Difference | Rule                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head       | `profile = "<name>"` and `selection = "exact"` or `"detect"` stand beside `version`, `level`, and `presets`                                        |
| Left out   | `[[scope]]`, `[[generated]]`, `[[vendored]]`, `[[check]]`, and any entry with `paths` are refused. An `[[ignore]]` with no `paths` travels (D-161) |
| Reasons    | a loosened setting keeps its reason, and the reason travels with the profile                                                                       |

`selection = "exact"` installs the named presets and what they require. Detection still runs,
and the plan lists what it found and did not install. `selection = "detect"` adds the detected
presets to the named ones. A profile is read through the same schema as the config, so a value
it carries is held to the same rules.

```toml
version   = 1
level     = "all"
profile   = "house-style"
selection = "exact"
presets   = ["typescript", "formatting", "spelling", "markdown", "commits"]

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
preset default
  → framework or platform preset, in selection order
  → root table
  → scope table
```

Lists append and drop repeats. Scalars replace. Two presets that set one scalar to two values
fail at load with both presets named, and a root value settles it.

## An old repository

gspot records no old findings, and installing it runs no check (D-165). `gspot check` reports
what it finds today. An old repository adopts gspot through four things that need no record:

- File-list checks run on changed files; affected whole-project checks keep all findings, including existing errors and errors in unchanged callers (D-168).
- The level `recommended` holds defect checks. Banned-term checks run at `all`.
- `gspot ignore` turns a check or a rule off. It works for the whole repository or for some paths.
- `git commit --no-verify` passes a hook, and a failing run names it.

## What a path is

Every tracked path is one of four kinds: source, generated, vendored, or binary. The sources
are `[[generated]]` and `[[vendored]]`, `.gitattributes`, a banner the preset knows, and the
first bytes of the file, in that order.

| Kind      | Checks that apply                                          |
| --------- | ---------------------------------------------------------- |
| source    | everything the selected presets claim for its kind of file |
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

Validate again immediately before each mutation. Use no-follow, handle-relative operations
where the platform supports them. Refuse a target whose ancestry cannot be kept safe.
Revalidation alone is not a defense against a symlink-swap race.
Tests cover case-insensitive filesystems, both path separators, spaces, and Windows drive forms.

Git integration is the one separate boundary: hooks use the path Git resolves for that clone,
including linked worktrees and `core.hooksPath`. The hook installer validates that resolved
location independently. A config below the Git root does not authorize other writes above the
config root. Tools can read dependencies outside the root where the repository declares them;
that grants no write or deletion authority. This is not a sandbox for arbitrary repository
commands.

Before replacing a developer file or task, save its exact bytes, mode, original path, and hash
under `.gspot/recovery/<operation>/`. Recovery directories and metadata are owner-only because originals can contain credentials; backup content never appears in reports or CI artifacts. Store the installed hash and ownership kind in
`.gspot/ownership.json`. Recovery is local, untracked, and required even with Git or
`--allow-dirty`. It is never treated as a cache or removed by cache eviction or uninstall.

If recovery cannot be written, refuse that replacement. A second operation never overwrites an
earlier original. In a fresh clone, tracked generated marks establish ownership but do not
invent an original that the clone never had.

`apply` and `remove` delete only marked outputs whose bytes still match the recorded installed hash.
In a fresh clone without a record, reproduce the expected value from its pinned config before
adopting the file into the ownership record. A mark alone never authorizes deleting modified
content. Modified outputs are retained and reported until the user restores or moves them.

Uninstall uses the same rule and removes only empty owned directories. Restoring an original
requires an absent destination or an unchanged gspot-installed value. Otherwise, preserve both
versions and print their paths. Interrupted operations resume from the ownership record;
serialize mutations with one lock per config root, and refuse a concurrent writer.

## Carrying configuration

Resolve ESLint configuration through the repository's ESLint for every governed file, then
group paths with equal resolved configurations. Extension-only sampling is insufficient.
Path-specific enabled rules use `[[tools.eslint.overrides]]`, with `paths` and `rules`;
disabled rules remain `[[ignore]]` entries. Base rules apply first, then matching overrides in declaration order, then ignores.

Override paths are config-root selectors and remain scope-bounded; profiles exclude these path-specific entries. Report that the captured paths describe current
files, not a reconstruction of arbitrary JavaScript selectors for future files.
Retain the original config whenever a plugin, processor, selector, or option cannot be carried
without loss. Never delete a config on the strength of a sampled result.

Use [Prettier resolveConfig](https://prettier.io/docs/api) per governed path with EditorConfig
enabled. Preserve path-specific differences through `[[format.overrides]]`, with `paths`
and the same fields as `[format]`. Later matching overrides win. Preserve unsupported
EditorConfig properties and sections by leaving the original file in place and reporting the
difference. A root pointer must not overwrite a retained config. Test root, nested, test,
server, and component paths that share an extension.

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

`init`, `add`, `remove`, and `upgrade` call `apply` before `install`.
A setting change calls `apply`; if dependencies change, its output names `gspot install`.
After a merge, resolve `gspot.toml`, run `apply` to rebuild conflicted outputs and locks, then
run `install`. No automatic package lifecycle script calls any of these commands.
