# The Settings: Extension Without Editing gspot

The requirement: the installing repository adds allowed typos, excluded functions, excluded files
and the rest, without changing gspot code.

The hazard: that mechanism is also how every rule quietly dies. `yap-swift-app` has 28
`lint:justify` suppressions of which twelve cite `N/A` as the ticket, a gitleaks baseline that grew
from 34 to 36 entries, two osv-scanner ignores with no expiry date, and sixteen environment
variables that turn checks off.

Both are solved by the same thing: make every extension typed, directional and counted against the
limit.

## One file

`gspot.toml` at the repository root. Tracked. gspot reads it and never writes it, including during
`gspot upgrade`. `gspot init` creates it once, and after that the file belongs to the consumer.

`gspot.local.toml` beside it. Untracked, git-ignored by the emitted `.gitignore` entry. It carries
machine-local skips and nothing else. A key that belongs to `gspot.toml` and appears in the local
file fails to load, so the local file cannot become a shadow policy.

## Anatomy

```toml
version = 1
runner  = "mise"                    # mise | bun | npm

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

# ---------------------------------------------------------------- tighten freely
[spell.typos]
add.words = [
  { word = "fpr",  reason = "GPG machine-readable fingerprint field" },
  { word = "udid", reason = "Apple API: Unique Device IDentifier" },
  { word = "nd",   reason = "Ordinal suffix in datetime code" },
]

[naming]
add.banned_terms           = ["helper", "wrapper"]
add.banned_term_exemptions = [
  { term = "buildValuesList", reason = "SQL VALUES clause, not a generic value list" },
  { term = "spawnSync",       reason = "Node API name" },
]

[prose.vocabulary]
add.accept = ["Supabase", "SwiftUI", "WebRTC", "pgTAP", "mise"]

[limits]
set.file_lines     = 250          # base is 300: tighten, allowed anywhere
set.function_lines = 50           # base is 60: tighten

[licenses]
add.allow = ["BlueOak-1.0.0", "Python-2.0"]

# ---------------------------------------------------------------- declarations
# One table. `kind` decides which checks still run. Nothing else does.
[[declare]]
kind        = "generated"
paths       = ["api/types/supabase.ts", "supabase/types/database.ts"]
produced_by = "supabase:gen:types"

[[declare]]
kind   = "vendored"
paths  = ["vendor/**"]
reason = "Upstream source, patched only by rebase"

[[declare]]
kind    = "partial"
paths   = ["ios/Yap/Assets.xcassets/**/Contents.json"]
reason  = "Xcode owns the format and rewrites it; schema validation fights the IDE"
owner   = "ios"
expires = "2027-03-01"

# ---------------------------------------------------------------- exceptions
[exceptions]
max = 12

[[exception]]
check   = "ts/eslint"
rule    = "local/no-cross-folder-imports"
paths   = ["api/config/tests/environment.ts"]
reason  = "The Vitest config loader cannot resolve the @config alias"
owner   = "api"
expires = "2026-12-31"

[[exception]]
check   = "py/basedpyright"
paths   = ["src/engines/trt/factory.py", "src/server/vllm.py"]
reason  = "TensorRT stubs are untyped upstream; a typed wrapper is tracked work"
owner   = "inference"
expires = "2026-12-31"

[[exception]]
check   = "deps/osv"
finding = "GHSA-vwc7-r8mq-g2x9"
reason  = "adm-zip symlink overwrite. No fixed release exists; upstream PR 575 open."
owner   = "platform"
expires = "2026-12-01"

# ---------------------------------------------------------------- migrations
# Required, no default. gspot init asks once. Every default is wrong for
# somebody: "none" lets gspot fix reformat shipped SQL, and "all" stops a
# pre-launch project from ever linting a migration.
[sql.migrations]
immutable_through = "20260415175157"   # "none" | "all" | a version

# ---------------------------------------------------------------- product files
[project]
compose_file  = "api/docker-compose.yml"
nginx_service = "nginx"
```

## Two tables, not ten

Every exclusion, exemption, exception and declaration in the settings file is one of exactly two
tables. An earlier surface had ten, which is the overlapping-option sprawl this design exists to
prevent.

### `[[declare]]`: this path is a special kind of thing

`kind` decides which checks still run, and it is the only thing that does.

| `kind`      | Checks that still run                        | Required beyond `paths`                        |
| ----------- | -------------------------------------------- | ---------------------------------------------- |
| `generated` | `secrets`, `freshness`, `determinism`        | `produced_by`, naming the task that writes it  |
| `frozen`    | `secrets`, `immutability`                    | `at`, the version that froze it                |
| `vendored`  | `secrets`, `license`                         | `reason`                                       |
| `binary`    | `secrets`, plus the asset policy             | nothing; usually derived from `.gitattributes` |
| `partial`   | whatever already claims it, and nothing more | `reason`, `owner`, `expires`                   |

There is no `kind = "ignore"`. Every declaration says what the path is, because the kind is what
decides which checks are still worth running. A path with no honest kind is a path that should be
checked.

### `[[exception]]`: this check does not apply here

One table for what used to be four: a disabled rule, an excluded path, a disabled check, and an
accepted finding. Four optional fields narrow it, and omitting all four disables the check entirely.

| Field                        | Narrows to                          | Required       |
| ---------------------------- | ----------------------------------- | -------------- |
| `check`                      | the check id                        | yes            |
| `rule`                       | one rule inside that check          | no             |
| `paths`                      | specific paths                      | no             |
| `symbol`                     | one function or type                | no             |
| `finding`                    | one finding id, such as an advisory | no             |
| `reason`, `owner`, `expires` |                                     | yes, all three |

`owner` is validated against `[owners]`. `expires` is validated as a date, and an expired exception
fails the gate. Both requirements exist because the reference set has a mandatory unvalidated ticket
field where twelve of 28 entries say `N/A`, and two accepted vulnerabilities with no expiry at all.

Every `[[exception]]` counts against `[exceptions] max`. `[[declare]]` entries with
`kind = "partial"` also count, because accepting partial coverage is a loosening. The other kinds do
not, because declaring a generated file is a statement of fact.

## Slots are typed

A preset declares its settings. A key targeting an undeclared setting fails to load, with the near
matches listed. That is the difference between an extension point and an way out: the surface is
finite and documented.

`gspot settings` prints every setting the current selection exposes, with its operations and direction:

```text
spell.typos.add.words                add        tighten-neutral
naming.add.banned_terms              add        tighten
naming.add.banned_term_exemptions    add        loosen      counted against the limit
naming.add.excluded_paths            add        loosen      counted against the limit
limits.set.file_lines                set        directional  (lower tightens)
ts.eslint.rules.<rule>               set        directional  (declared per rule)
ts.eslint.ignores                    add        loosen      counted against the limit
prose.vocabulary.add.accept          add        loosen      counted against the limit, per-term reason
declare (kind = generated)           add        neutral     requires produced_by
declare (kind = partial)             add        loosen      counted against the limit, requires expiry
```

## Direction, and why it is mechanical

Each setting declares direction in the preset manifest, so classification never depends on judgement:

- `tighten`: adds a rule, lowers a limit, adds a banned term. No metadata required.
- `neutral`: adds a path alias, declares a generated file, names a product fact. No metadata
  required.
- `loosen`: adds an exemption, adds an ignore, raises a limit, disables a rule, excludes a path from
  a check. **Requires `reason`, `owner`, `expires`, counts against the limit, and appears in every
  run report.**
- `directional`: the direction follows the value. `set.max_file_lines = 250` against a base of 300
  tightens. `= 400` loosens and needs the metadata. `ts.eslint.rules.<rule> = "off"` loosens;
  `= "error"` tightens.

An allowed typo is the interesting edge. Adding a word to the typos dictionary technically loosens
the spell check, and requiring an owner and an expiry for the word `udid` would be absurd. The
resolution: `spell.typos.add.words` is `tighten-neutral` but requires a `reason` per entry, and the
reason is what `yap-swift-app` already writes as a comment above each word. No limit, no expiry, but
no bare list either.

## The limit

`[exceptions] max = N` caps the number of loosening entries. Exceeding it fails the gate. Lowering
it is a normal commit; raising it is a visible one.

The limit replaces three mechanisms in the reference repositories that did not work:

| Reference mechanism                        | Why it failed                                          | Limit behaviour                                                                               |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `lint:justify reason: X ticket: Y`         | Any token counted as a ticket. Twelve of 28 say `N/A`. | `owner` is validated against `[owners]`, `expires` against a date, and an expired entry fails |
| gitleaks `baseline.json`, 34 to 36 entries | Nothing counts the growth                              | Each baseline entry is a `[[exception]]`, counted                                             |
| `osv-scanner.toml` ignores with no expiry  | Nothing ever revisits them                             | `expires` is required; an expired exception fails the gate                                       |

`gspot exceptions` prints the list:

```text
exceptions         7 / 12
  ts/eslint        2   expires 2026-12-31 (106 days)  owner api
  py/basedpyright  2   expires 2026-12-31 (106 days)  owner inference
  naming           3   no expiry required (exemptions)
findings accepted  3
  deps/osv         2   1 expires in 76 days
  secrets/gitleaks 1   expires 2027-01-15
declarations
  generated        2   freshness asserted by task supabase:gen:types
  partial          1   expires 2027-03-01 (166 days)
  vendored         1
expiring in 30 days  none
expired              none
```

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

- **Lists merge by `add` then `remove`.** `add` deduplicates. `remove` subtracts and fails when the
  value is absent, because a stale removal is the same class of defect as the eight dead globs in
  `yap-swift-app`.
- **Scalars are last-write-wins with direction checked at each layer.**
- **No layer can be silently empty.** A `[[scope]]` naming a path that does not exist fails. An
  `add` that changes nothing fails. This is deliberate: every entry in the settings file has to be
  doing work, or it gets deleted.
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
the files a check reads then verifies the translation by asking the tool. The translation being wrong is therefore a
coverage failure rather than a silent coverage loss.

## Extending the naming policy

Worth a section because the policy is the densest asset: 290 lines, 94 banned terms, five language
sections, 15 exemptions.

Base ships as `@gspot/naming/policy/base.json`. The consumer never copies it.

```toml
[naming]
add.banned_terms           = ["fixture", "shim"]
remove.banned_terms        = ["render"]            # loosen: needs metadata
add.banned_term_exemptions = [{ term = "renderToString", reason = "React DOM API name" }]
add.excluded_paths         = ["ios/Yap/Generated/**"]
add.reserved_terms         = [{ term = "payload", allowed_kinds = ["queue message body"] }]

[naming.languages.swift]
add.case_exemptions = ["URLSession"]
```

`remove.banned_terms = ["render"]` is loosening and needs a reason, an owner and an expiry.
`add.banned_term_exemptions` is scoped loosening: it exempts one identifier rather than unbanning a
word, it needs a reason per entry, and it counts against the limit. That distinction is the one
`yap-swift-app` already draws by hand with its fifteen `bannedTermExemptions`, made explicit.

## Excluding a function

Named in the requirement, so it gets a worked example. Three different things share the phrase, and
they are separate settings:

```toml

# 1. A function the dead-code checks must not report

[structure] add.entry_points = [ { symbol = "handleSignal", paths = ["api/src/runtime/*.ts"], reason
= "Registered by name from the process signal table" }, ]

# 2. A function exempt from the length or complexity limit

[[exception]] check = "structure/function-length" symbol = "buildMigrationPlan" paths =
["supabase/src/plan.ts"] reason = "A single ordered statement list; splitting it hides the order"
owner = "data" expires = "2027-01-31"

# 3. A function the naming policy must not judge, because a platform names it

[naming] add.banned_term_exemptions = [{ term = "setUpClass", reason = "unittest lifecycle hook" }]
```

Slot 1 is the answer to `yap-text-inference/[tool.vulture] ignore_names` and
`[tool.ruff] lint.pep8-naming.extend-ignore-names`, both currently empty lists waiting to be abused.
Slot 1 is `neutral` and needs a reason. Slots 2 and 3 are counted against the limit.

## Making a change

Policy is edited in `gspot.toml`, then `gspot sync`. The table below is the whole
surface most repositories ever touch, each row a copy-paste. One command writes to the
file, because it does something a hand edit cannot: `gspot exceptions add`
refuses without a reason and an owner and prints the coverage the exception
removes before writing. A banned-term finding names the group that matched, so you
see why a name fails before you exempt it. The command is in [16-cli.md](16-cli.md). Easy and accounted are not in tension: an
exception is one line to write and impossible to hide.

### The twelve most common edits, as raw TOML

For anyone who prefers the file. This is the whole surface most repositories ever touch.

| Want                                        | TOML                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Allow a word the spell checker rejects      | `[spell.typos]` `add.words = [{ word = "udid", reason = "Apple API" }]`                  |
| Ban a term in identifiers                   | `[naming]` `add.banned_terms = ["dispatcher"]`                                           |
| Exempt one identifier from a banned term    | `[naming]` `add.banned_term_exemptions = [{ term = "setUpClass", reason = "..." }]`      |
| Change a file or function size limit        | `[limits]` `set.file_lines = 250`                                                        |
| Change a shell limit                        | `[limits.shell]` `set.function_lines = 60`                                               |
| Turn off one rule of one linter             | `[ts.eslint.rules]` `"unicorn/no-null" = "off"` plus a `[[exception]]` entry             |
| Turn off a whole check                      | `[[exception]]` with `check`, `reason`, `owner`, `expires`                               |
| Exclude a path from one check               | `[[exception]]` with `check`, `paths`, `reason`, `owner`, `expires`                      |
| Declare a generated file                    | `[[declare]]` `paths = [{ path = "...", produced_by = "..." }]`                          |
| Accept a vulnerability for now              | `[[exception]]` with `check`, `finding`, `reason`, `owner`, `expires`                    |
| Add an allowed licence                      | `[licenses]` `add.allow = ["BlueOak-1.0.0"]`                                             |
| Keep a function the dead-code check reports | `[structure]` `add.entry_points = [{ symbol = "...", paths = ["..."], reason = "..." }]` |
| Say which migrations are frozen             | `[sql.migrations]` `immutable_through = "none" \| "all" \| "<version>"`                  |

### What is deliberately not easy

Three things take more than one command, because each one should cost thought.

| Not easy                                                  | Why                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Removing the `marketing` or `defensive` banned-term group | Refused by the preset. A repository that wants `enhancedHandler` permitted is not using this distribution. |
| Raising `[exceptions] max`                                | A hand edit to a tracked file, visible in review. That is the whole point of a limit.                    |
| Disabling the coverage check                              | There is no setting for it. Coverage gaps are declared per path, with a kind, or they fail.              |
| Adding a warning tier                                     | There is none. A rule with a backlog uses the baseline, which has an expiry.                             |

## Upgrade safety

`gspot upgrade` never writes `gspot.toml`. It can fail against it, and the failures are the useful
part:

| Situation                               | Behaviour                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A setting was renamed                      | Load fails with the old name, the new name, and the release note                                           |
| A setting was removed                      | Load fails, naming the check that no longer exists                                                         |
| A new rule arrives with a known backlog | Lands in the baseline with a baseline, see [09-gates.md](09-gates.md)                                      |
| A default tightened                     | Reported in the upgrade diff; the consumer either fixes the code or adds a counted against the limit `set` |
| A preset now claims new extensions        | The coverage check reports the newly claimed paths as `partial` until they pass                      |

There is no automatic migration of the settings file, because an automatic migration is how a
loosening entry survives a rename without anybody reading it again.
