# Lifecycle: Detect, Install, Adopt, Update

Three scenarios, and the design has to serve all three. The third is the hard one.

| Scenario                        | Example                                          | Difficulty                                       |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| New repository                  | `gspot init` on day one                          | Easy. Zero findings, full strictness.            |
| Clean repository adopting gspot | `yap-swift-app`, which already has a strict gate | Medium. Mostly a translation of existing policy. |
| Messy repository adopting gspot | `slopshop`, with 1,056 lines of known findings   | Hard. Needs the baseline.                        |

## Detect

`gspot init` prints three things, then asks once before it writes anything.

### 1. The proposed selection

```text
$ gspot init

scopes detected
  .                root
  api              tsconfig.json, package.json, Dockerfile
  supabase         supabase/config.toml, tsconfig.json, 83 .sql files
  ios              Yap.xcodeproj, 724 .swift files

presets proposed
  root       language:markdown language:bash repository:configuration repository:structure
             repository:naming repository:prose repository:secrets
             repository:dependencies repository:licenses repository:commits
  api        language:typescript framework:express tool:docker tool:vitest
  supabase   language:typescript language:sql database:postgres platform:supabase
             tool:vitest
  ios        language:swift tool:xcode

runner proposed
  mise       mise.toml present with 22 tool pins
```

### 2. The extension coverage

Run regardless of what else was detected, and the part that matters:

```text
extensions present in the tree, by claim status

claimed
  .ts      839   language:typescript
  .swift   724   language:swift
  .sql      83   language:sql
  .sh      204   language:bash       (including 107 extensionless, by shebang)
  .md       21   language:markdown
  .json    112   repository:configuration
  .toml      9   repository:configuration
  .png     982   binary, via .gitattributes filter=lfs
  ...

unchecked by any proposed preset
  .pbxproj       1   -> enable tool:xcode, or declare
  .xcconfig      4   -> enable repository:configuration, or declare
  .entitlements  4   -> enable repository:configuration, or declare
  .xcstrings     3   -> enable repository:configuration, or declare
  .storyboard    1   -> enable repository:configuration, or declare
  .xctestplan    1   -> enable tool:xcode, or declare
  .pgsql         9   -> language:sql claims this; sqlfluff sql_file_exts will be set
  .wav          79   -> binary; declare, or enable repository:assets
  (no extension) 3   -> .githooks/*, claimed by language:bash via shebang
```

Every row is a decision, and no row is silent. That list is the eleven blind spots from the
reference audit, computed rather than discovered by an audit.

### 3. The existing-policy diff

`gspot init` reads the repository's current tool configuration and proposes settings that
preserves it, so adoption starts from the repository's own policy rather than from gspot's defaults.

```text
existing configuration read from 14 files

preserved into gspot.toml
  format.indent_width       4          from .prettierrc.json tabWidth
  format.print_width        120        from .prettierrc.json printWidth
  format.quote_style        single     from .prettierrc.json singleQuote
  spell.typos.add.words     8 entries  from typos.toml [default.extend-words]
  licenses.add.allow        12 entries from .license-checker.json onlyAllow
  limits.file_lines         300        from quality/config/limits.js
  naming policy             290 lines  from quality/naming/policy.json

differs from the gspot default, decide per row
  markdownlint MD013        off        gspot derives it from format.print_width (120)
  shellcheck disable        6 codes    gspot disables the same 6 by default: no change
  sqlfluff ignore           sql/       gspot cannot express this. It hides 58 of 83 files.
                                       -> remove it, or declare the paths
  eslint api tests          untyped    gspot types tests by default
                                       -> accept, or add an exception
  vitest expect-expect      off        gspot enables it with a baseline at 100
```

The `sqlfluff ignore` row is the moment the tool earns its existence. A migration that starts by
telling the team it has been linting 30 percent of its SQL is worth the install on its own.

## Init

Interactive when stdout is a terminal. Every question has a flag, and `--yes`
accepts every proposal, so `gspot init --yes` is the one-command install: detect
everything, decide everything by the rules below, write everything. With no
terminal and no flag for a question, `init` exits 2 and names the flag.

| Question | Flag |
| --- | --- |
| 1 Scopes | `--scope <name=path>`, repeatable |
| 2 Presets | `--presets <id,id>`, per scope as `--presets api=language:typescript,framework:express` |
| 3 Unchecked extensions | `--declare <ext=kind>`, repeatable |
| 4 Runner | `--runner mise\|bun\|npm` |
| 5 Rules | `--rules-only`, `--no-rules`, `--import-rules` |
| 6 Migrations | `--migrations none\|all\|<version>` |
| 7 Strictness | `--strict` or `--baselines` |
| 8 Gate | `--gate hooks\|ci\|split` |

What `--yes` chooses when nothing else is said: the detected scopes and presets,
every unchecked extension declared by its detected kind, the detected runner
(mise if `mise.toml` exists, else the package manager the lockfile names, else
npm), rules installed and existing rules imported, migrations frozen through the
newest one already applied in the repository if that can be read and `none`
otherwise, baselines, and `split`.

```text
$ gspot init

1  Scopes
   Detected 4 scopes. Accept, edit, or start from one root scope? [accept]

2  Presets per scope
   Accept the proposal, or select per scope? [accept]

3  Unchecked extensions
   8 extension groups are unchecked. For each: enable a preset, or declare.
   .pbxproj (1)      -> [enable tool:xcode]
   .wav (79)         -> [declare binary]
   ...

4  Runner
   mise detected. Use mise, or bun scripts, or npm scripts? [mise]
   Note: under bun or npm, 14 of 31 tools are not npm packages and gspot
   downloads them with pinned checksums. Under mise they are one pin each.

5  Rules
   Install CLAUDE.md, AGENTS.md and rules/? [yes]
   Existing rules/ found: 11 files, 13,940 lines.
   -> Import and split into layers, or start from the gspot corpus? [import]

6  Migrations
   25 migrations found under supabase/migrations.
   Which are frozen? [none | all | a version]  proposed: 20260415175157

7  Strictness
   a) Full strictness now. The gate fails until the tree is clean.
   b) Adopt with baselines. Counts measured now, expiry dates set, the gate
      passes today and tightens on a schedule.
   [b]

8  Gate
   Hooks, CI, or split by requirement? [split]
   No .github/ found. Emit a workflow? [no]
   Note: hooks are bypassable with --no-verify. Without CI there is no second gate.
```

### What init does with what is already there

A repository that adopts gspot has tooling. The rules for each kind, so that the
one-command install lands in a state with one owner per job:

| Found | init does |
| --- | --- |
| A tool configuration gspot generates (`.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `ruff.toml`, `[tool.ruff]`, `.swiftlint.yml`, `.markdownlint*`, `.sqlfluff`, `.shellcheckrc`, `typos.toml`, `.vale.ini`, and the rest) | Reads it through the tool's own print-config, carries every value into `gspot.toml` as the policy diff shows, then deletes the file. Two configurations for one tool is drift, and git keeps the old one. The plan lists every file that goes. |
| A rule the existing configuration enables that gspot does not ship (a plugin, a custom rule) | Kept, through the settings `add` block for that tool, and listed. Nothing is silently dropped. |
| A tool whose job a gspot check now does (Biome, oxlint, standard, flake8, black, isort, pylint alone, husky) | Removed whole: its config file, its dependency in `package.json` or `pyproject.toml` or `mise.toml`, its scripts, its hook steps, its ignore file. Each removal is listed with the gspot check that replaces it. Two tools for one job is the drift gspot exists to end, and git keeps the old state. |
| A tool with no gspot equivalent | Left alone. Its config files are tracked files and are checked as configuration. To put it in the gate, the team adds a `[[check]]` in `gspot.toml`. |
| A hook runner (`.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, `simple-git-hooks` in `package.json`) | Reads what each hook runs. Steps a gspot check replaces are dropped. Steps that are not lint (a custom script) are listed for the team to move into a task. Then the runner's files and its `prepare` script are removed and `core.hooksPath` is set. |
| CI workflows | Never edited. Lint jobs they contain are listed as redundant. gspot emits its own workflow only under `gate = "ci"` or `"split"`, and only when asked. |
| `mise.toml` | Used as the runner. gspot writes `[tools]` from its lock and `[tasks]` for its tasks and leaves `[env]` and the rest alone. A pin that disagrees with the lock fails with both values named; gspot never silently wins. |
| `package.json` | The lockfile names the package manager. gspot adds its npm tools as pinned dev dependencies. A dev dependency already present at another version is set to the pin, and listed; an explicit different pin in `gspot.toml` fails with both values named. TypeScript is the exception: it is the project's dependency and gspot uses the project's version, with a stated minimum, because types must resolve against the code. |
| `rules/`, `CLAUDE.md`, `AGENTS.md` | Imported and split into layers, below. The originals are replaced by the generated files. |
| `.gitignore`, `.gitattributes`, `.prettierignore` | One managed block appended between markers. The rest untouched. |

What this reuses instead of writing: each tool's own print-config to read its
current configuration (the same mechanism coverage uses), `package-manager-detector`
for the package manager, `mise` for tool pins, the manifests themselves for
frameworks (`package.json` dependencies, `pyproject.toml`, `Package.swift`,
`supabase/config.toml`). Language detection is by tracked extension and shebang,
which coverage needs anyway; a linguist-style library would be a second answer
to the same question.

Step 5's "import and split" is the interesting one, and it is a real feature, not a copy. The
importer:

- Reads every existing `rules/*.md`.
- Classifies each section by heading against the layer rules, using the same term list the rules
  lint uses.
- Writes the general layer, 1 and 2 files from the sections that pass their layer, merged with the
  gspot corpus where both cover a subject, with conflicts listed rather than silently resolved.
- Writes the project layer files from the sections that fail the generated layers, which is where
  the ownership map and the MVVM layering land.
- Prints a report: how many lines went to each layer, and every conflict.

For the reference corpus, that report is the R11 deliverable, computed.

## Adopt

Baselines are the answer for a messy repository. `init` writes them under
strictness (b), and `sync` writes them for a preset added later. There is no
separate command.

```text
$ gspot init --baselines

measuring 41 baseline-eligible rules over 4127 paths

baselines written
  ts/eslint     sonarjs/cognitive-complexity        88   expires 2027-03-16
  ts/eslint     vitest/expect-expect               100   expires 2026-12-16
  swift/lint    no_magic_numbers                   921   expires 2027-03-16
  swift/lint    one_declaration_per_file           294   expires 2027-03-16
  prose/vale    gspot.modals                 237   expires 2026-12-16
  prose/vale    gspot.dashes                  312   expires 2026-10-16
  structure     file-length                         14   expires 2026-12-16
  ...

not baseline-eligible, must pass now
  every syntax, schema and format check
  every secrets and license check
  the coverage check

coverage  4127 paths   0 unchecked   17 partial   3 partial   0 orphan
          -> 20 paths need a declaration before the gate passes.
             gspot check --unchecked prints them.

gate status after init: fails on 20 coverage declarations, passes otherwise
```

Two properties:

1. **Format, syntax, schema, secrets and licences are never given a baseline.** They are mechanical
   and fixable in one commit, and a formatter backlog is not a backlog.
1. **The coverage check is never given a baseline.** A declaration is cheap and a coverage gap is
   not. Twenty declarations is twenty minutes of work and the whole point of the install.

Expiry default is ninety days, or one hundred and eighty for rules that imply file splitting
(`one_declaration_per_file`, `file-length`), because those are refactors rather than edits.

## Staged adoption

For a repository that wants a schedule rather than a decision:

| Rung | What lands                                                                              | Gate effect                                     |
| ---- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | `gspot init --rules-only`                                                               | None. Agent rules, nothing enforced.            |
| 2    | Add `repository:spelling`, `repository:secrets`, `repository:formatting`, format checks | One formatting commit, then clean               |
| 3    | Add `language:*` syntax, schema and type checks                                         | Real findings, all mechanical                   |
| 4    | Add the coverage check                                                                  | The coverage conversation, and the declarations |
| 5    | Add `language:*` style checks, with baselines                                          | Baselines, schedule                             |
| 6    | Add `repository:structure` and `repository:naming`, with baselines                       | The largest backlog, longest expiry             |
| 7    | Add `repository:prose` core, then strict                                                | Vale, in two steps                              |
| 8    | Add `repository:vulnerabilities`, `repository:dependencies`, `repository:licenses`      | Exceptions                                         |
| 9    | Hooks, then CI                                                                          | The gate becomes real                           |

Nine rungs, each a commit. A repository can stop at any rung and the result is coherent.
`gspot init` at full strictness is rung 9 on day one, which is right for a new repository and wrong
for `slopshop`.

## Updates

A distribution that ships rules to other repositories lives or dies on this. An upgrade that breaks
the gate does not get taken, and a distribution nobody upgrades stops being one.

### What a version pins

`gspot@0.3.0` fixes every one of these:

| Pinned                                            | Where the consumer sees it               |
| ------------------------------------------------- | ---------------------------------------- |
| The preset set, and which rules each preset enables   | `.gspot/generated/*`                     |
| Every tool version and its checksum, per platform | `.gspot/tools.lock`                      |
| The naming policy document                        | `.gspot/generated/*` for each language   |
| The structural rule files                         | the findings they produce                |
| The Vale styles and the pinned style packages     | `.gspot/tools.lock`                      |
| The rule corpus                                   | `rules/` and the two index files         |
| The settings schema                               | `gspot.toml` fails to load on a mismatch |

One version, one `gspot` entry in one manifest, one number in a report. A consumer never resolves a
preset version, because the interesting failure is drift between presets and a single version removes
it.

`gspot.toml` carries its own `version = 1`, which is the **settings schema** version and moves far
more slowly than the tool. The two numbers answer different questions: one says which rules ran, the
other says whether the file parses.

### The commands

| Command                    | Does                                                                                    | Network |
| -------------------------- | --------------------------------------------------------------------------------------- | ------- |
| `gspot upgrade --check`    | Reports what a newer version would change. Writes nothing.                              | yes     |
| `gspot upgrade`            | Moves to the newest version, re-renders, writes baselines, reports the coverage change. | yes     |
| `gspot upgrade --to 0.3.0` | Moves to an exact version. Works downward, which is how a rollback happens.             | yes     |
| `gspot install`          | Downloads and verifies every tool in `tools.lock`.                                      | yes     |
| `gspot sync`               | Re-renders every generated file from the current version and `gspot.toml`.              | no      |
| `gspot sync --check`             | Fails when a generated file differs from its render.                                    | no      |
| `gspot check`              | Runs the gate.                                                                          | no      |

The network boundary is the load-bearing part. `upgrade` and `install` reach the network. `sync`,
`sync --check` and `check` never do. So a lint run never fails because a registry is slow. It also never
pulls a different rule set than the one the last commit recorded.

### What an upgrade prints

The report is the product. A consumer decides from this alone whether to take the version now or
later.

```text
$ gspot upgrade --check

gspot 0.2.1 -> 0.3.0

rules
  + typescript      import-x/no-cycle                  new       3 findings
  + data            taplo schema for mise.toml         new       0 findings
  + javascript      tsc --checkJs                      new     142 findings
  ~ structure       function_lines  60 -> 50           stricter 22 findings
  ~ naming          group "verbs-strict" gained 2 terms          4 findings
  - typescript      local/no-imports-after-statements   removed, replaced by import-x/first

tools
  ~ eslint          9.38.0 -> 9.41.2
  ~ ruff            0.14.1 -> 0.15.0        3 rules moved out of preview
  + ls-lint         2.3.1                   new, required by repository:naming
  - license-checker 25.0.1                  removed, unmaintained

rule corpus
  ~ rules/general/WORKING.md          12 lines changed
  + rules/general/GIT.md              new, 64 lines
  ~ rules/language/TYPESCRIPT.md      31 lines changed
    rules/project/**                  untouched, as always

presets now available that this repository does not select
  language:go        would claim 14 files currently reported as unchecked
  framework:express  would add 7 checks to scope api

settings schema
  ok    version 1 unchanged, every setting in gspot.toml still exists

coverage change
  + 23 paths newly claimed   (14 .toml by the taplo schema check, 9 .js by types)
  - 0  paths lose coverage
  ! 0  paths change status for the worse

action required on upgrade
  4 new baselines, with a 90-day expiry each
  1 tool to install: ls-lint. `gspot install` handles it.
```

Six sections, and every one answers a question a consumer actually asks. The one that matters most
is **coverage change**, because it is the only line that can report a regression in what gets
checked at all.

### The four rules of an upgrade

### 1. An upgrade never writes `gspot.toml`

The settings file belongs to the consumer, permanently. An upgrade reads it, and can fail against
it, and never edits it.

When a setting is renamed or removed, the load fails and names the old setting, the new setting and
the release note. **There is no alias and no compatibility shim.** An automatic migration lets a
loosening entry survive a rename with nobody reading it again. That outcome is what the whole design
exists to prevent.

### 2. A new rule never breaks the build on arrival

A rule that arrives with findings enters the baseline with a measured baseline and a required
expiry, per [09-gates.md](09-gates.md). The gate passes on the day of the upgrade and tightens on a
schedule.

Without this rule, an upgrade that adds a good rule is an upgrade nobody takes. A distribution whose
upgrades nobody takes has no way to ship a good rule.

Three categories never baseline, because a declaration or a formatter run fixes them in one commit:
format, syntax and schema.

### 3. Coverage never falls silently

An upgrade that makes a preset stop claiming an extension **fails**. The coverage check delta is
computed before anything is written, and a negative delta aborts the upgrade with the affected paths
listed.

This is the one hard failure in the upgrade path, and it exists because coverage loss is the failure
mode nobody notices. A rule that gets stricter is loud. A tool that quietly stops reading a
directory is not.

### 4. An upgrade is one reviewable commit

Generated configuration is tracked, per [07-config-generation.md](07-config-generation.md), so an
upgrade produces a diff:

```text
 package.json                      1 +-      the gspot version
 .gspot/tools.lock                12 +-      versions and checksums
 .gspot/generated/eslint.config.js 8 +-      the new rule, the removed rule
 .gspot/generated/ruff.toml        3 +
 .gspot/generated/typos.toml       0
 .gspot/baseline/*.json            4 +       new baselines with expiry dates
 .gspot/coverage.json             23 +-      newly claimed paths
 rules/general/GIT.md             64 +       new corpus file
 rules/language/TYPESCRIPT.md     31 +-
 CLAUDE.md                         0         generated index, unchanged
```

A reviewer sees the rule change, the tool change, the corpus change and the coverage change in one
place. That is the review signal no reference repository has, because all four reference
repositories keep their policy in hand-written files and their tool versions in a second file and
their corpus in a third.

### New presets

A new version adds presets. It never enables them.

`language:go` arriving in 0.3.0 changes nothing for a repository that has no Go. For a repository
that does have Go, those files were **already** reported as unchecked before the upgrade, so the
coverage check was already failing or the paths were already declared. The upgrade report says what
the new preset would claim, and enabling it is a separate, deliberate commit:

```text
$ gspot upgrade --check
language:go        14 files match, currently: 14 unchecked
framework:express  detected: express in api/package.json

$ add `language:go` to `presets` and run `gspot sync`
```

Adding a preset edits nothing but the `presets` array, then runs `sync` and reports the new
findings, and `sync` writes baselines for the new area the same way `init` does.

Three properties follow.

- **Enabling a preset is never automatic.** A tool that starts checking new files without being asked
  is a tool that breaks builds on a Tuesday.
- **A declared gap stays declared.** A `[[declare]]` entry for `**/*.toml` keeps working after
  `repository:configuration` gains a TOML schema check. The upgrade report notes that the declaration is now
  removable.
- **Detection re-runs on demand.** `gspot doctor` after an upgrade proposes presets for technologies
  the repository gained since init.

### Tool versions

`.gspot/tools.lock` is tracked and holds, per tool and per platform, the version, the download URL
and the SHA-256.

| Situation                                     | Behaviour                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Upgrade moves a tool version                  | The lock changes in the upgrade diff, with the old and new version visible                      |
| A checksum does not match on download         | `gspot install` refuses and names the tool. It never proceeds on a mismatch.                  |
| A tool is missing at check time               | `skipped(reason)`, which fails the gate, with `gspot doctor` naming the lost coverage           |
| The consumer runs `runner = "mise"`           | The `[tools]` block is emitted from the same lock, so mise and gspot cannot disagree            |
| A consumer pins a tool higher than gspot does | The resolve fails and names both constraints. Silent precedence is how a version skew survives. |

A tool version is never resolved at check time. The lock is the answer, the lock is in git, and a
check run reads it without asking anything.

### The corpus, across an upgrade

`rules/` is generated, so an upgrade re-assembles it. `rules/project/` is the consumer's and is
never written by gspot.

| Command              | Does                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `gspot sync`   | Re-assemble from the current version and selection                |
| `gspot report --rules` | Per file: layer, preset, enforced statements, unenforced statements |

An edit to a generated rule file fails `gspot sync --check` on the next run, with the diff and the two
ways forward: move the change into `rules/project/`, or open it upstream. That is deliberate. A
repository that edits a shipped rule has forked the corpus, which is the thing four forks of one
corpus already proved costly.

`CLAUDE.md` and `AGENTS.md` name no rule file, per [10-rules.md](10-rules.md), so a corpus that
gains or loses a file leaves both index files byte-identical. That is the property that makes corpus
updates cheap.

### Automation

gspot never commits. `gspot upgrade` writes to the working tree, and a person
commits the result. That is the same rule the shipped git rules state for
agents, and gspot holds itself to it.

What that means for a dependency bot: bumping the `gspot` version alone breaks
the tree, because every generated file is stale until `gspot upgrade` re-renders
it and `gspot sync --check` fails on the next run. Any automation that bumps the
version must run `gspot upgrade` in the same change and commit what it wrote.
gspot does not ship that automation. The repository's own tooling does, or a
person does.

### Discovering that an update exists

A gate that phones home is a gate that fails offline. So `gspot check` never checks for updates and
never prints a notice.

Three places report an available version, all of them opt-in:

- `gspot doctor`, which a human runs.
- `gspot upgrade --check`, which is the explicit question.
- The scheduled job, for a repository that enabled one.

### Rollback

Downgrading is upgrading with a lower number, and it works because everything that matters is
tracked.

```text
gspot upgrade --to 0.2.1      # re-renders every generated file from 0.2.1
```

Or, for a repository that has committed the upgrade and wants it gone: `git revert` the upgrade
commit and run `gspot sync`. The revert restores the version, the lock, the configs, the baselines,
the coverage check and the corpus together, because they landed together.

Two constraints on a rollback, both stated rather than papered over:

1. **A baseline written by a newer version stays.** Reverting the version leaves a baseline file for
   a rule that no longer exists, and `gspot sync --check` reports it as orphaned so it gets deleted
   deliberately.
1. **A setting added for a newer version fails the older load.** The message names the setting
   and the version that introduced it. Removing the setting is the fix, and it is a visible edit to
   `gspot.toml`.

### What the changelog has to contain

`gspot upgrade --check` prints its report by reading a machine-readable changelog that ships with
each release. Prose alone cannot produce the report above.

```toml
[[change]]
kind     = "rule-added"
preset     = "language:typescript"
rule     = "import-x/no-cycle"
reason   = "Cycles were caught only by knip, and only for exports."
baseline = true

[[change]]
kind     = "rule-stricter"
preset     = "repository:structure"
setting  = "function_lines"
from     = 60
to       = 50
reason   = "Measured across the fixture set: 60 was never the binding constraint."
baseline = true

[[change]]
kind      = "settings-setting-renamed"
from      = "structure.add.keep_alive"
to        = "structure.add.entry_points"
reason    = "keep_alive reads as a network setting."
migration = "Rename the key. The value shape is unchanged."

[[change]]
kind   = "tool-removed"
tool   = "license-checker"
reason = "Unmaintained since 2021. license-checker-rseidelsohn is the fork."
```

Four `kind` values carry a `migration` string, and those are the only changes that can fail a load:
a renamed setting, a removed setting, a removed preset, a settings schema bump. Everything else lands as a
finding, a baseline or a diff.

The changelog is also the enforcement mechanism for honesty about the release. A rule that ships
without a `[[change]]` entry fails the release gate, the same way a check that no task runs fails
the preset loader.
