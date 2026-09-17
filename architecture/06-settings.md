# The Settings: Extension Without Editing gspot

The requirement: the installing repository adds allowed typos, excluded functions, excluded files
and the rest, without changing gspot code.

The hazard: that mechanism is also how every rule quietly dies. `yap-swift-app` has 28
`lint:justify` suppressions of which twelve cite `N/A` as the ticket, a gitleaks baseline that grew
from 34 to 36 entries, and sixteen environment variables that turn checks off.

Both are solved by the same thing: every extension is typed, carries a reason, and appears in the
run report. Nothing is hidden. Nothing is capped.

## One file

`gspot.toml` at the repository root. Tracked. gspot reads it and never writes it, including during
`gspot upgrade`. `gspot init` creates it once, and after that the file belongs to the consumer.

Nothing in it is specific to one ecosystem. A table named after a preset holds that preset's
settings and exists only when the preset is selected, so a repository with no SQL has no `[sql]`
table and a repository with no Docker has no `[docker]` table. The root of the file holds what every
repository has: the selection, the scopes, the gate, the limits, and the three tables below.

`gspot.local.toml` beside it. Untracked, git-ignored by the emitted `.gitignore` entry. It carries
machine-local skips and nothing else. A key that belongs to `gspot.toml` and appears in the local
file fails to load, so the local file cannot become a shadow policy.

## Anatomy

```toml
version = 1
runner  = "mise"                    # mise | bun | npm

[gate]
hooks = true                        # true | false
ci    = "none"                      # none | github | gitlab | buildkite

presets = [
  "language:typescript", "language:swift", "language:sql", "language:bash", "repository:configuration",
  "tool:docker", "language:markdown",
  "database:postgres", "platform:supabase", "framework:express", "tool:xcode",
  "repository:structure", "repository:naming", "repository:prose", "repository:secrets",
  "repository:vulnerabilities", "repository:dependencies", "repository:licenses",
  "repository:commits",
]

# ---------------------------------------------------------------- scopes
[[scope]]
path  = "api"
presets = ["language:typescript", "framework:express", "tool:docker"]

[[scope]]
path  = "supabase"
presets = ["language:typescript", "language:sql", "database:postgres", "platform:supabase"]

[[scope]]
path  = "ios"
presets = ["language:swift", "tool:xcode"]

# ---------------------------------------------------------------- tool settings
[spelling.typos]
add.words = [
  { word = "fpr",  reason = "GPG machine-readable fingerprint field" },
  { word = "udid", reason = "Apple API: Unique Device IDentifier" },
  { word = "nd",   reason = "Ordinal suffix in datetime code" },
]

[naming]
add.banned_terms = ["helper", "wrapper"]

[prose.vocabulary]
add.accept = ["Supabase", "SwiftUI", "WebRTC", "pgTAP", "mise"]

[limits]
set.file_lines     = 250
set.function_lines = 50

[licenses]
add.allow = ["BlueOak-1.0.0", "Python-2.0"]

[commits.commitlint]
set.scopes = ["api", "supabase", "ios", "hooks", "root", "deps"]

[security.semgrep]
add.rules = ["quality/semgrep/api.yml"]

# ---------------------------------------------------------------- the repository's own checks
[[check]]
id         = "sql/migration-headers"
command    = ["node", "quality/sql/index.js"]
inspects       = ["style"]
paths      = ["supabase/migrations/**/*.sql"]
stage      = "pre-commit"
fails_on   = "exit-code"

# ---------------------------------------------------------------- declarations
[[declare]]
paths       = ["api/types/supabase.ts", "supabase/types/database.ts"]
produced_by = "supabase:gen:types"

[[declare]]
paths  = ["vendor/**"]
reason = "Upstream source, patched only by rebase"

# ---------------------------------------------------------------- exceptions
[[exception]]
check  = "coverage"
paths  = ["ios/Yap/Assets.xcassets/**/Contents.json"]
reason = "Xcode owns the format and rewrites it; schema validation fights the IDE"

[[exception]]
check  = "ts/eslint"
rule   = "local/no-cross-folder-imports"
paths  = ["api/config/tests/environment.ts"]
reason = "The Vitest config loader cannot resolve the @config alias"

[[exception]]
check  = "py/basedpyright"
paths  = ["src/engines/trt/factory.py", "src/server/vllm.py"]
reason = "TensorRT stubs are untyped upstream"

[[exception]]
check   = "deps/osv"
finding = "GHSA-vwc7-r8mq-g2x9"
reason  = "adm-zip symlink overwrite. No fixed release exists; upstream PR 575 open."

[[exception]]
check  = "naming"
symbol = "spawnSync"
reason = "Node API name"

# ---------------------------------------------------------------- preset settings
# A preset's own settings live under its name. A preset that is not selected
# has no settings, so nothing here is in the schema for a repository that does
# not use it.
[sql]
immutable_through = "20260415175157"   # "none" | "all" | a version

[docker]
compose_file  = "api/docker-compose.yml"
```

## Three tables, not ten

Every exclusion, exemption, exception, declaration and bespoke script in the settings file is one
of exactly three tables. An earlier surface had ten, which is the overlapping-option sprawl this
design exists to prevent.

### `[[declare]]`: what this path is

Two shapes, no vocabulary to learn.

```toml
[[declare]]
paths       = ["types/database.ts"]
produced_by = "db:gen:types"      # a task writes this file

[[declare]]
paths  = ["vendor/**"]
reason = "Upstream source, patched only by rebase"   # nobody here writes this file
```

`produced_by` means a task produces the file, so gspot runs that task and diffs the result. That is
the only assertion about a generated file worth making, and it replaces linting its style.

A `reason` alone means the file is not the project's to fix: vendored code, an upstream copy, a
template with placeholders no parser accepts. gspot checks it for secrets and leaves it.

Either way the file is claimed, so it is not a coverage gap, and either way the declaration says
what the path is rather than which rule to skip. A path with no honest answer is a path that should
be checked.

Binary files need no declaration. They are detected from `.gitattributes` or by content, and get a
secrets scan. Frozen files are not declared here either: which files must not change after they
land is a property the preset that knows about them owns, such as `[sql] immutable_through`.

### `[[exception]]`: this check does not apply here

One table for what used to be four: a disabled rule, an excluded path, a disabled check, and an
accepted finding. Four optional fields narrow it, and omitting all four disables the check entirely.

| Field     | Narrows to                          | Required |
| --------- | ----------------------------------- | -------- |
| `check`   | the check id                        | yes      |
| `rule`    | one rule inside that check          | no       |
| `paths`   | specific paths                      | no       |
| `symbol`  | one function or type                | no       |
| `finding` | one finding id, such as an advisory | no       |
| `reason`  |                                     | yes      |

No owner, no expiry, no cap. A reason is the one field that has to be there, because an exception
without one is the `N/A` ticket the reference set is full of. Every exception is listed in every
run report, with its reason, so the list is read at every push and nobody has to go looking for it.
A messy repository needs a hundred of these on day one. That is a fact about the repository, not a
number to be argued with.

### `[[check]]`: a script the repository already has

A check the consumer writes joins the same graph, the same stages and the same coverage table as a
preset check. It has the fields a preset check has: `id`, `command`, `inspects`, `paths`, `stage`,
`fails_on`, and optionally `requires`, `fix` and `file_list`. See [02-model.md](02-model.md).

This is how nothing bespoke is lost at install. `yap-text-inference` has fourteen shell checks
that no off-the-shelf tool covers. `yap-swift-app` has a SQL migration header linter. Both keep
running from day one as `[[check]]` entries, and each one is a candidate for replacement by a
preset later, or not. The test for the design is that every script under a reference repository's
`quality/` directory either maps to a preset check or lands here.

## Every tool has a slot

A preset declares its settings. A key targeting an undeclared setting fails to load, with the near
matches listed. That makes the surface finite and documented, and it puts an obligation on every
preset: **every tool that has a configuration exposes the options a real repository sets.** The
reference repositories set options on commitlint, html-validate, purgecss, jscpd, Semgrep, Trivy,
ShellCheck and stylelint, and a preset that ships one of those tools without a slot for its options
is a preset that cannot be installed on the repository it came from. At init, an option found in an existing config
that has no slot is listed as dropped in the plan, never carried silently, and the slot is added
to the preset.

`gspot config` prints every setting the current selection exposes:

```text
spelling.typos.add.words                add
naming.add.banned_terms              add
naming.add.reserved_terms            add
naming.add.structural_prefixes       add
limits.set.file_lines                set
ts.eslint.rules.<rule>               set
prose.vocabulary.add.accept          add
commits.commitlint.set.scopes        set
commits.commitlint.set.types         set
html.validate.rules.<rule>           set
site.purgecss.add.safelist           add
duplication.jscpd.set.<threshold>    set     per language
security.semgrep.add.rules           add     paths to rule files
shell.shellcheck.add.disable         add     per-code reason
structure.add.entry_points           add     per-symbol reason
declare                              add     paths plus produced_by or a reason
```

Three operations:

- `add` appends to a list, deduplicated.
- `remove` subtracts from a list. A removal of a value that is absent is reported as dead.
- `set` replaces a scalar.

A list entry that loosens a check, an exemption, an ignore, an accepted word, carries a `reason`.
That is the whole ceremony.

## Merge semantics

The merge is total and ordered. For every configuration value:

```text
base      = preset default
         -> preset overrides from a framework preset, in declared order
         -> scope settings
         -> root settings
         -> gspot.local.toml           (skips only)
```

Rules:

- **Lists merge by `add` then `remove`.**
- **Scalars are last-write-wins.**
- **A `[[scope]]` naming a path that does not exist fails.** An `add` that changes nothing, or a
  `remove` of a value that is absent, is reported by `gspot generate` as a dead entry and does not
  fail: an upstream default change must not break a consumer's load.
- **Conflicting `set` between two framework presets fails at resolve time** with both presets named.
  Silent precedence is how `yap-swift-app` lost its shared `no-restricted-syntax` selectors when the
  api override replaced the list instead of merging it.

## Path selectors

Every setting that takes paths uses one syntax, resolved by one library, documented once. gitignore
semantics are the cause of the worst coverage bug in the reference set, so gspot does not adopt them
for its own selectors.

```text
api/src/**/*.ts            glob, root-relative, always
!api/src/generated/**      negation
api/src/*.ts               single level
```

Rules: root-relative always, no bare directory names, `**` required to cross a directory boundary,
negation after inclusion. A bare `sql/` fails to parse with the message naming the `.sqlfluffignore`
failure it prevents.

When gspot renders a tool config, it translates its own selectors into that tool's dialect, and the
file listing then verifies the translation by asking the tool. The translation being wrong is
therefore a coverage failure rather than a silent coverage loss.

## Extending the naming policy

Worth a section because the policy is the densest asset: 290 lines, 94 banned terms, five language
sections, 15 exemptions.

Base ships as `@gspot/naming/policy/base.json`. The consumer never copies it.

```toml
[naming]
add.banned_terms           = ["fixture", "shim"]
add.reserved_terms         = [{ term = "payload", allowed_for = ["queue message body"] }]
add.structural_prefixes    = [{ paths = ["scripts/steps/*.sh"], regex = "^\\d{2}-" }]
```

Loosening the policy is not done here. Unbanning a term for one identifier, or for one directory,
is an `[[exception]]` against `naming` with a `symbol` or `paths`, which is where every other
"this does not apply here" lives. `yap-swift-app` draws exactly this distinction by hand with its
fifteen `bannedTermExemptions`; the difference is that here they sit in one list with the reasons,
instead of in a second mechanism. `add.structural_prefixes` is the one `yap-text-inference` draws with thirteen path-scoped
name rules: a prefix the case and length checks strip before judging the rest.

## Excluding a function

Named in the requirement, so it gets a worked example. Three different things share the phrase, and
they are separate settings:

```toml
# 1. A function the dead-code checks must not report
[structure]
add.entry_points = [
  { symbol = "handleSignal", paths = ["api/src/runtime/*.ts"], reason = "Registered by name from the process signal table" },
]

# 2. A function exempt from the length or complexity limit
[[exception]]
check  = "structure/function-length"
symbol = "buildMigrationPlan"
paths  = ["supabase/src/plan.ts"]
reason = "A single ordered statement list; splitting it hides the order"

# 3. A function the naming policy must not judge, because a platform names it
[[exception]]
check  = "naming"
symbol = "setUpClass"
reason = "unittest lifecycle hook"
```

Slot 1 is the answer to `yap-text-inference/[tool.vulture] ignore_names` and
`[tool.ruff] lint.pep8-naming.extend-ignore-names`, both currently empty lists waiting to be abused.

## Making a change

Policy is edited in `gspot.toml`, then `gspot generate`. No command writes to the file. The table
below is the whole surface most repositories ever touch, each row a copy-paste.

| Want                                        | TOML                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Allow a word the spell checker rejects      | `[spelling.typos]` `add.words = [{ word = "udid", reason = "Apple API" }]`                  |
| Ban a term in identifiers                   | `[naming]` `add.banned_terms = ["dispatcher"]`                                           |
| Exempt one identifier from a banned term    | `[[exception]]` with `check = "naming"`, `symbol`, `reason`                               |
| Change a file or function size limit        | `[limits]` `set.file_lines = 250`                                                        |
| Change a shell limit                        | `[limits.shell]` `set.function_lines = 60`                                               |
| Turn off one rule of one linter             | `[[exception]]` with `check`, `rule`, `reason`                                           |
| Turn off a whole check                      | `[[exception]]` with `check`, `reason`                                                   |
| Exclude a path from one check               | `[[exception]]` with `check`, `paths`, `reason`                                          |
| Declare a generated file                    | `[[declare]]` with `paths` and `produced_by`                                            |
| Accept a vulnerability                      | `[[exception]]` with `check`, `finding`, `reason`                                        |
| Accept weaker coverage on a path            | `[[exception]]` with `check = "coverage"`, `paths`, `reason`                              |
| Add an allowed licence                      | `[licenses]` `add.allow = ["BlueOak-1.0.0"]`                                             |
| Keep a function the dead-code check reports | `[structure]` `add.entry_points = [{ symbol = "...", paths = ["..."], reason = "..." }]` |
| Keep a script the repository already runs   | `[[check]]` with `id`, `command`, `inspects`, `paths`, `stage`                               |
| Skip a check on this machine only           | `gspot.local.toml` `skip = ["docker/nginx-config"]`                                      |
| Say which migrations are frozen             | `[sql]` `immutable_through = "none" \| "all" \| "<version>"`                              |

### What is deliberately not easy

Two things have no setting, because each one should cost thought.

| Not easy                                                  | Why                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Removing the `marketing` or `defensive` banned-term group | Refused by the preset. A repository that wants `enhancedHandler` permitted is not using this distribution. |
| Disabling the coverage check                              | There is no setting for it. Coverage gaps are declared per path, saying what the path is, or they fail.               |

## Upgrade safety

`gspot upgrade` never writes `gspot.toml`. It can fail against it, and the failures are the useful
part:

| Situation                               | Behaviour                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| A setting was renamed                   | Load fails with the old name, the new name, and the release note                            |
| A setting was removed                   | Load fails, naming the check that no longer exists                                          |
| A new rule arrives with a known backlog | Lands in the baseline, see [09-gates.md](09-gates.md)                                       |
| A default tightened                     | Reported in the upgrade diff; the consumer either fixes the code or adds a `set` with a reason |
| A preset now claims new extensions      | The coverage check reports the newly claimed paths as `partial` until they pass             |

There is no automatic migration of the settings file, because an automatic migration is how a
loosening entry survives a rename without anybody reading it again.
