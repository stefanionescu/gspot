# Configuration

This document decides the one file a person edits, the files gspot owns, and how settings merge.

## Files

| Path                                               | Owner                              | Tracked | Purpose                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gspot.toml`                                       | the repository                     | yes     | The policy. Written by `init`, changed by the six writing commands (`ignore`, `add`, `remove`, `allow`, `set`, `declare`) or by hand; every load validates it the same way.                                             |
| `gspot.local.toml`                                 | one machine                        | no      | Local skips. Nothing else.                                                                                                                                                                                              |
| `.gspot/<tool>.<ext>`                              | gspot                              | yes     | Generated tool configuration. Header names the writer.                                                                                                                                                                  |
| `.gspot/version`                                   | gspot                              | yes     | The gspot version this repository runs. One line. Written by `init`, moved by `upgrade`.                                                                                                                                |
| `.gspot/hooks/*`                                   | gspot                              | yes     | Git hooks.                                                                                                                                                                                                              |
| `.gspot/baseline/*.json`                           | gspot                              | yes     | Recorded finding counts.                                                                                                                                                                                                |
| `.gspot/rules/**`                                  | gspot                              | yes     | Installed agent rule files.                                                                                                                                                                                             |
| `.gspot/cache/**`                                  | gspot                              | no      | Check results keyed on inputs.                                                                                                                                                                                          |
| `.gspot/last.json`                                 | gspot                              | no      | The last run.                                                                                                                                                                                                           |
| `.gitignore`                                       | gspot, managed block               | yes     | Lists the three untracked paths above: `gspot.local.toml`, `.gspot/cache/`, `.gspot/last.json`.                                                                                                                         |
| `<conventional path>` stubs                        | gspot                              | yes     | One-line files that point editors at `.gspot/`.                                                                                                                                                                         |
| `.editorconfig`                                    | gspot                              | yes     | Owned whole by the formatting preset, rendered from `[format]`; `[tools.editorconfig.extra]` adds a section gspot does not render.                                                                                      |
| `.config/mise/conf.d/gspot.toml`                   | gspot                              | yes     | Tool pins and tasks under the mise runner.                                                                                                                                                                              |
| `.github/workflows/gspot.yml`                      | gspot                              | yes     | The CI job, when enabled.                                                                                                                                                                                               |
| `.vscode/settings.json`, `.vscode/extensions.json` | gspot, managed block               | yes     | Editor wiring, when `[editor] vscode = true`.                                                                                                                                                                           |
| `gspot.schema.json`                                | gspot, published with each release | no      | The JSON schema of `gspot.toml`, generated from the zod schema and submitted to SchemaStore, so taplo and editors validate the file as they do `mise.toml`. `init` writes a `#:schema` line at the top of `gspot.toml`. |

Every generated file opens with a header:

```text
# Generated by gspot 0.4.0 from gspot.toml. Do not edit.
# Change policy: gspot set / allow / ignore, or edit gspot.toml, then run: gspot sync
```

JSON files carry the same text under a `"_gspot"` key, except a JSON file whose reader refuses
unknown keys (Prettier's), which carries none and is known from the rendered list. `sync --check`
compares every rendered file with the disk and finds strays by the header, so a renamed or copied
generated file is still caught, and gspot writes them read-only where the platform allows, as
projen does.

## `gspot.toml`

```toml
version = 1

# The selection. Presets are bare names. See presets/README.md.
presets = ["typescript", "bash", "sql", "supabase", "docker", "markdown"]

# A scope is a subtree with its own selection. Root presets apply everywhere.
[[scope]]
path    = "api"
presets = ["typescript", "express", "docker", "nginx", "vitest"]

[[scope]]
path    = "ios"
presets = ["swift", "xcode"]

# Limits. Only keys a check reads exist. A value above the shipped default carries a reason.
# A root key applies to every language. A language table overrides it for that language only.
[limits]
file_lines            = 300
function_lines        = { value = 80, reason = "Route tables are one ordered list each." }
cyclomatic_complexity = 8
cognitive_complexity  = 8

[limits.python]
file_lines = { value = 400, reason = "Pydantic models for one API surface live in one module." }

[limits.bash]
file_lines     = 140
function_lines = 40

# Naming. Extends the shipped policy. Terms are whole identifier parts.
[naming]
banned_terms = ["dispatcher", "orchestrator"]
allowed      = [{ name = "spawnSync", reason = "Node API name" }]
reserved     = [{ term = "data", allowed_for = ["API success envelope field"] }]

# Per-language ceilings and cases. Defaults are the shipped table in 08-naming-policy.md.
[naming.python]
max_chars = 35
max_words = 4

[naming.python.parameters]
max_words = { value = 3, reason = "Handler signatures read as one line." }

[naming.swift]
max_chars = { value = 45, reason = "UIKit delegate methods are long by convention." }

[[naming.rules]]
paths = ["api/scripts/steps/*.sh"]
categories = ["files"]
structural_prefix = "^\\d{2}-"

# Architecture. Elements, the import matrix between them, file roles, and the types directory.
[architecture]
types_directory = "types"            # every type alias lives here; see structure rules
elements = [
  { name = "app",      paths = ["src/app/**"] },
  { name = "modules",  paths = ["src/modules/**"] },
  { name = "platform", paths = ["src/platform/**"] },
  { name = "env",      paths = ["src/env/**"] },
  { name = "config",   paths = ["config/**"] },
  { name = "types",    paths = ["types/**"] },
  { name = "tests",    paths = ["tests/**"] },
  { name = "entry",    paths = ["src/main.ts"] },
]
# default: an element imports only itself. Each row adds the elements it is allowed to import.
allow = [
  { from = "app",      to = ["config", "modules", "platform", "env", "types"] },
  { from = "modules",  to = ["config", "platform", "env", "types"] },
  { from = "platform", to = ["config", "env", "types"] },
  { from = "config",   to = ["types"] },
  { from = "env",      to = ["config", "types"] },
  { from = "tests",    to = ["app", "modules", "platform", "env", "config", "types", "entry"] },
  { from = "entry",    to = ["app", "modules", "platform", "env", "config", "types"] },
]
# Roles drive the shipped import-direction rules. Unset roles fall back to element names.
roles = { types = "types", config = "config", env = "env", tests = "tests", support = "tests/support/**", runtime = ["app", "modules", "platform"] }

[structure]
reexports = "none"                   # none | index-only
call_through_allowed = [{ file = "src/openapi/components.ts", name = "buildErrorResponseExample", reason = "Public name is the stable contract." }]

# Per-tool passthrough. Keys are the tool's own option names. Rendered into the template.
# A tool's own "disable", "ignore" or "exclude rules" option is never a slot: those lines are
# rendered from the [[ignore]] entries for the check, so what does not run is in one place.
[tools.eslint]
rules = { "unicorn/prefer-ternary" = ["error", "only-single-line"] }   # rule options; off is an [[ignore]]
import_style = { "src/**" = "js", "functions/**" = "ts", "scripts/**" = "extensionless" }

[tools.trufflehog]
enabled = { value = false, reason = "This repository has no credentials a verifier can test." }

[tools.typos]
words = [{ word = "udid", reason = "Apple API name" }]

[tools.markdownlint.extra]           # an option with no slot; rendered verbatim, printed every run
reason = "MD044 proper names are not a slot yet."
MD044  = { names = ["gspot", "Supabase"], code_blocks = false }

[tools.commitlint]
scopes = ["api", "ios", "supabase", "root", "deps"]

[[tools.licenses.exceptions]]
package = "certifi@2025.8.3"
license = "MPL-2.0"
reason  = "The Mozilla Public License covers the certificate bundle, not repository source."

[tools.package-json]
scripts = "wrappers"                 # any | wrappers | none
allowed_scripts = { build = "node build/index.js", lint = "gspot check" }

[tools.install]
min_release_age_days = 7             # bun minimumReleaseAge, npm min-release-age, pnpm minimumReleaseAge
security_scanner = "@socketsecurity/bun-security-scanner"

# A check this check does not apply to these paths. Reason required. Printed every run.
[[ignore]]
check  = "structure/single-file-folder"
paths  = ["scripts/**"]
reason = "One launcher script per environment."

[[ignore]]
check  = "typescript/eslint"
rule   = "gspot/no-cross-folder-imports"
paths  = ["api/config/tests/environment.ts"]
reason = "The Vitest config loader cannot resolve the @config alias."

# No paths: the rule is off everywhere in the scope. This is how a rule is turned off,
# for gspot's own checks and for every tool (ShellCheck SC codes, Ruff codes, SwiftLint ids).
[[ignore]]
check  = "typescript/eslint"
rule   = "unicorn/no-null"
reason = "carried from eslint.config.mjs at init"

[[ignore]]
check  = "bash/shellcheck"
rule   = "SC2312"
reason = "set -e interaction on every correct if-function."

[[ignore]]
check   = "dependencies/osv"
finding = "GHSA-vwc7-r8mq-g2x9"
reason  = "adm-zip symlink overwrite. No fixed release exists."

# What a path is. Generated files get freshness and secrets checks; vendored files get secrets and licenses.
[[declare]]
paths       = ["api/types/supabase.ts"]
produced_by = "supabase gen types"

[[declare]]
paths  = ["vendor/**"]
reason = "Upstream source, patched only by rebase."

# A script the repository already runs. Joins the graph like a preset check.
[[check]]
id       = "sql/migration-data"
command  = ["bunx", "tsx", "supabase/scripts/migrations.ts", "check"]
paths    = ["supabase/migrations/**/*.sql"]
stage    = "commit"

[hooks]
manager = "gspot"          # gspot | lefthook | husky | none

[ci]
provider = "github"        # github | none

[rules]
install   = true
directory = ".gspot/rules"
project   = "rules/project"

[editor]
vscode = true              # writes managed blocks into .vscode/settings.json and extensions.json

[coverage]
strict = false             # true: unchecked files fail `check`

[runner]
surface = "mise"           # mise | npm | bun | pnpm | uv | none
```

### Rules for the file

- Every setting in the file has a command that writes it (`gspot set`, `allow`, `ignore`,
  `declare`, `add`, `remove`), and `gspot doctor --settings` prints the key to use. A person who
  prefers the editor edits the file; the result is the same and is validated on the next load.
- Presets are bare names. A preset that does not exist fails to load, with the near matches.
- A setting a selected preset does not expose fails to load, with the settings that exist under
  that table. The surface is finite and `gspot doctor --settings` prints it.
- A `[[scope]]` path names a directory that exists. Scopes do not nest.
- Every `[[ignore]]` carries a `reason` that is a sentence. `N/A`, `TBD`, `-` and an empty
  string are refused. Every ignore prints on every run with `--verbose` and is counted in the
  summary line.
- Raising a limit above the shipped default, turning a rule or a tool off, adding a typo word,
  adding an allowed name: each carries a reason. Lowering a limit or adding a banned term does not.
- `[limits.<language>]` and `[naming.<language>]` take the language preset ids (`python`,
  `typescript`, `javascript`, `swift`, `bash`, `sql`). A key there overrides the root key for
  that language's checks. `[naming.<language>.<category>]` narrows to one identifier category
  (`files`, `directories`, `types`, `functions`, `parameters`, `variables`, `properties`). The
  keys are `max_chars`, `max_words` and `case`. A ceiling above the shipped default or a looser
  case carries a reason.
- A rule inside a tool is turned off by an `[[ignore]]` with `rule` and no `paths`, never by a
  tool slot. `[tools.<name>.rules]` holds rule options and rules turned on; `off` there fails to
  load and names the `ignore` line.
- The `marketing` and `defensive` term groups cannot be removed as groups. Individual names in
  them take scoped `allowed` entries.
- `[[check]]` entries have `id`, `command`, `paths`, `stage`, and optionally `fix`, `count_regex`,
  `requires` (`build`, `docker`, `network`) and `platform` (`macos`, `linux`, `windows`; a check
  whose platform is not this machine's is a platform skip and prints so). A `[[check]]` is how a
  repository runs anything gspot does not ship: a second type-check project under a different
  dependency set, a generator, a product test. It joins the graph like a preset check, and no
  preset grows a slot for it.
- A key gspot does not know fails to load. The one place for an option gspot has no slot for is
  `[tools.<name>.extra]`, which carries a reason and prints every run; nothing is silent.

### Architecture

`[architecture]` is read by the boundaries rules, the import-direction rules, the types rules
and the Python contracts. Without it, a scope has one element and the import-direction rules
use these defaults: `types` is any directory named `types`, `tests` is `tests/**` and test files,
`support` is `tests/support/**`, `config` is `config/**`, `env` is `src/env/**`.

The shipped import-direction rules, always on:

1. `types` imports only types, exports no runtime value, no function, no class, no default.
2. `runtime` never imports `tests` or `support`.
3. `tests` and `support` never import a `runtime` element's internals, only its element
   contract (`index`, `public` or `contracts` files) or `types`.
4. `config` and `env` never import `runtime`.

`types_directory` turns on the types placement rules: no `interface`; every type alias and every
`as const` object that replaces an enum lives under that directory; imports from it are
`import type`. Exceptions go through `[[ignore]]` with a reason. `init` proposes the directory
name from what exists.

### Tool passthrough

`[tools.<name>]` holds the options a person changes on that tool. Each preset declares the slots
its tools expose, with the option's own name, so a person who knows ESLint writes
`rules = { ... }` and a person who knows Prettier writes `printWidth`. The template renders them
into the tool's format. An option with no slot fails to load and names the slots that exist.
A rule slot holds options and rules turned on; turning a rule off is an `[[ignore]]`, so there is
one place to look for what does not run.

Every tool exposes `enabled`. Setting it false, with a reason, removes every check that tool
runs and prints the reason every run. This is the control over what runs; `init` is the control
over what is installed.

Every tool a preset ships exposes the options a real repository sets. A preset that ships a tool
with no slots for its common options is incomplete.

Every tool also exposes `[tools.<name>.extra]`: a table rendered verbatim into the tool's
configuration, after the slots, with a required `reason`. It is the escape hatch for an option no
slot covers yet, so a missing slot never blocks a person. Every `extra` table prints on every
run, `doctor --settings` lists it under "not a slot", and `upgrade --check` reports when a new
release adds a slot for a key an `extra` table holds, so the key moves up and the escape hatch
empties over time. A key in `extra` that a slot already covers fails to load and names the slot.

## Merge order

For every setting:

```text
preset default
  → framework or platform preset override, in selection order
  → root table
  → scope table
```

Lists append and deduplicate. Scalars replace. Two presets that set the same scalar to different
values fail at load with both presets named; a person resolves it with an explicit root value.

## Baselines

```json
{
  "check": "typescript/eslint",
  "rule": "vitest/expect-expect",
  "count": 100,
  "recorded": "2026-09-17",
  "paths": { "api/tests/unit/turn.test.ts": 7 }
}
```

- `init` writes one file per rule that has findings. The gate passes that day.
- Where a tool has its own baseline mechanism, gspot drives it instead of counting: ESLint's
  bulk suppressions (`--suppress-all` at `init`, `--suppressions-location
.gspot/baseline/eslint.json` on every run, `--prune-suppressions` under `sync --baseline`) and
  basedpyright's `--writebaseline` with the file under `.gspot/baseline/`. The tool then honors
  the same file in the editor, so the editor and the gate agree. Every other check uses the count
  file above. The person sees one command either way.
- `check` fails when the count exceeds the baseline, or when a touched file's own count grows.
  A count below the baseline passes and prints.
- `sync --baseline` lowers every baseline to the last run's counts. It never raises one.
- Format, syntax and schema findings never baseline. A formatter run fixes them in one commit.
- A baseline for a rule that no longer exists is reported by `sync --check` and removed by
  `sync --baseline`.

## `gspot.local.toml`

```toml
skip = ["docker/hadolint"]      # this machine has no Docker
```

One key. Any other key fails to load with the message that it belongs in `gspot.toml`. Skips
print on every run.

## Declarations and file natures

Every tracked path has one nature: `source`, `generated`, `vendored`, `binary`. Sources are
`[[declare]]`, `.gitattributes` (`linguist-generated`, `linguist-vendored`, `-text`, `filter=lfs`),
a generated-file banner the preset knows, and a content sniff for binaries, in that order.

| Nature    | Checks that apply                                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source    | everything the selected presets claim for its extension                                                                                                                                                                                                        |
| generated | secrets, freshness (run `produced_by` and diff). Freshness applies to tracked files only: a generated file that git ignores (`next-env.d.ts`, `cloudflare-env.d.ts`) is regenerated by the build and has nothing to compare, so the check skips it and says so |
| vendored  | secrets, licenses, vulnerabilities                                                                                                                                                                                                                             |
| binary    | secrets, size limit unless under LFS                                                                                                                                                                                                                           |

A source file no preset claims is `unchecked`. `doctor` lists it. With `[coverage] strict = true`
it fails `check`.

## Path selectors

One syntax everywhere: root-relative globs, `**` crosses directories, `!` negates after an
include. A bare directory name is refused with a message: write `dir/**`. This is the syntax a
misread `.sqlfluffignore` entry violated when it hid 58 of 83 files in a reference repository,
and gspot never translates its own selectors into a tool's ignore syntax. It passes file lists.
Selectors use forward slashes on every platform.
