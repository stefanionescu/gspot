# Adoption, Updates and Removal

What a person sees from the moment they run gspot in a repository nobody here has seen, through
upgrades, to removing it. This document governs. Where another document disagrees with it, this one
is right and the other is stale.

## What gspot is allowed to know

Three sources, and no others:

1. **The tracked file list.** `git ls-files`, or a walk that honours `.gitignore` when there is no
   git. Extensions and shebangs come from here.
2. **Manifest contents.** `package.json`, `pyproject.toml`, `Package.swift`, `go.mod`,
   `Cargo.toml`, `Gemfile`, and a tool's own configuration file when it has one at a path that tool
   defines. Dependencies and frameworks come from here.
3. **The answers the person gives.**

Everything else it asks a tool. It never infers meaning from a folder name, never assumes where
source lives, and never assumes a layout it has not been shown. A repository that keeps its code in
`app/`, `lib/`, `Sources/` or the root is the same repository to gspot.

## What gspot writes

Two paths it chose, and nothing else without a yes:

```text
gspot.toml     the policy. Tracked. The only file with our name at the root.
.gspot/        everything generated: tool configs, hooks, the coverage table, run reports.
```

Git's `core.hooksPath` points at `.gspot/hooks/` when hooks are on. Generated tool configuration
lives in `.gspot/` and every tool is invoked with an explicit config path, so gspot cannot collide
with a config the repository already has and does not need to know which filename that config uses.

The one reason to write at a conventional path is that an editor plugin does its own discovery.
That is a question at init, not a default, and when the answer is yes gspot writes a one-line file
that extends the real config in `.gspot/`, using the filename that already exists rather than
inventing a second one.

## First run

`gspot init`. Interactive when stdout is a terminal. Every question has a flag, and `--yes` takes
every proposal. **Nothing is written until the final confirmation.** Quitting at any point before it
leaves the repository exactly as it was.

### Step 1: what is here

```text
$ gspot init

reading 3,330 tracked files

languages        typescript 836   swift 724   sql 85   bash 99   markdown 21
frameworks       express        api/package.json: express 4.21
                 supabase       supabase/config.toml
projects         3 manifests found: ./package.json, api/package.json, supabase/package.json
runner           mise           mise config ls: ./mise.toml
hooks            .husky/        pre-commit, pre-push
ci               none found
agent rules      CLAUDE.md (349 lines), AGENTS.md (4 lines), rules/ (11 files)

already linting  eslint, prettier, typos, markdownlint, commitlint, shellcheck,
                 sqlfluff, swiftlint, gitleaks, semgrep
                 plus 3 tools gspot does not know: qlty, lychee, syncpack
```

Nothing has been decided. This is a reading.

### Step 2: the questions

Asked in order of consequence. A question with an obvious answer is stated, not asked.

**1. Projects.** Three manifests were found, so gspot proposes three scopes plus the root. Accept,
edit, or treat the whole tree as one. Scopes come from where manifests actually are, never from a
folder's name.

**2. Presets.** The proposal, per scope, from the detection above. Accept or edit. A language with
files and no preset is listed so the gap is visible.

**3. The tools you already run.** Yes or no, per tool. Yes means gspot owns it: your config is read,
every value carried into `gspot.toml`, and the file deleted. No means gspot does not touch it and
does not drive it, and the files only that tool reads are reported as a coverage gap.

```text
  eslint        [yes]   reads eslint.config.mjs, 94 rules carried
  prettier      [yes]   reads .prettierrc.json, 4 values carried
  swiftlint     [yes]   reads ios/.swiftlint.yml, 87 rules carried
  ...
  qlty          [no]    gspot has no equivalent
```

No to everything is allowed, and gspot says what it means: there is nothing left for it to own, so
it stops without writing anything.

A tool gspot has no equivalent for is not asked about. It is left alone, and listed at the end as
something the repository can put in the gate with a `[[check]]` entry whenever it wants to.

**4. File classes nothing claims.** Every extension in the tree with no preset that reads it. For
each: enable a preset, or declare what it is. No row is silent.

**5. Hooks.** Install git hooks? An existing hook runner proposes yes and replacement.

**6. CI.** Set up CI? Existing CI with a lint job proposes replacing that job. Existing CI without
one proposes adding one. No CI proposes no. gspot never creates CI where none exists without a yes.

**7. Rules.** Install `CLAUDE.md`, `AGENTS.md` and the rule files? See below for what happens when
they already exist.

There is no question about strictness. gspot measures. A tree with no findings gets a gate that
passes, and a tree with findings gets a baseline per rule, the count printed, falling from there.

### Step 3: the plan

Everything that will happen, before anything happens.

```text
write
  gspot.toml                        your policy, 61 lines
  .gspot/                           14 tool configs, 3 hooks, the coverage table

delete
  eslint.config.mjs                 94 rules carried into gspot.toml
  .prettierrc.json                  4 values carried
  ios/.swiftlint.yml                87 rules carried
  .husky/                           replaced by .gspot/hooks/
  ...                               11 files total

change
  package.json                      remove 6 devDependencies gspot now pins
  mise.toml                         add 9 tool pins. Your 22 pins are untouched.
  CLAUDE.md                         append one marked block. Nothing of yours is read or moved.
  .gitignore                        append one marked block

leave alone
  qlty, .qlty/                      gspot has no equivalent
  lychee, lychee.toml               gspot has no equivalent

gate status after this
  fails on 20 coverage declarations, 7 rules enter a baseline, everything else passes

Continue? [y/N]
```

One confirmation. Nothing above happens before it. Git holds everything that gets deleted.

## Agent rule files that already exist

A `CLAUDE.md` in the repository is the person's file. gspot does not read it, move it, split it or
rewrite it.

What it does is append one delimited block, the same mechanism it uses for `.gitignore`, pointing at
the rule files it installed. Regeneration only ever touches the text between the markers. If the
person deletes the block, gspot writes it again on the next `generate` and nothing else changes.

Their existing rules stay exactly where they are and keep applying. If they later want them split
into gspot's layers, that is a deliberate act they ask for, not something an installer does to their
prose. The design elsewhere proposes importing and splitting an existing corpus at init; that is an
editorial project, not an install step, and it does not belong here.

Where the rule files themselves land is a setting, defaulting to `.gspot/rules/`. A repository that
already has a `rules/` directory keeps it and gspot stays out of it.

## Saying no

Every question has a no, and every no has a defined end state.

| No to | What happens |
| --- | --- |
| Every tool | gspot has nothing to own. It writes nothing and says so. |
| One tool | That tool keeps its config and gspot does not drive it. The coverage report says which files lose an inspection. |
| Hooks | No hooks, no `core.hooksPath` change. Checks run from `gspot check`. |
| CI | No workflow is written, no existing workflow is read again. |
| Rules | No `CLAUDE.md`, no `AGENTS.md`, no rule files. The gate is unaffected. |
| The final confirmation | Nothing is written. The repository is untouched. |

## Adding something later

Detection is not a one-time event, but `init` refuses to run on a repository that already has a
`gspot.toml`. Afterwards:

`gspot doctor` re-runs detection and prints what is present and not enabled: a language with files
and no preset, a framework in a manifest with no preset, a tool installed and not driven.

Enabling it is an edit to `gspot.toml` followed by `gspot generate`. There is no command that writes
the file for you, because the file is one line per decision and a command that writes one line is a
command that hides the decision.

## What happens to a tool gspot drives

For each, at init: its configuration is read through the tool's own print-config where it has one,
every value it carries is written into `gspot.toml` as the plan showed, and the file is deleted.
Its dependency entry is removed from the manifest, because gspot pins it now. Two configurations for
one tool is the drift this exists to end, and git holds the old one.

A rule the old configuration enabled that gspot does not ship is kept, through the settings slot for
that tool, and listed. Nothing is dropped silently. An option with no slot is listed as dropped in
the plan, and the slot is added to the preset rather than the option being quietly lost.

## Removal

`gspot uninstall` removes what `init` wrote and `install` downloaded: `.gspot/` entirely, the
`core.hooksPath` setting, the marked blocks in `CLAUDE.md`, `AGENTS.md` and `.gitignore`, and the CI
job if gspot wrote one. It leaves `gspot.toml`, which is the person's, and it restores nothing,
because git holds the state before `init` and a tool that tries to reconstruct it will get it wrong.

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
| `gspot generate`               | Re-renders every generated file from the current version and `gspot.toml`.              | no      |
| `gspot generate --check`             | Fails when a generated file differs from its render.                                    | no      |
| `gspot check`              | Runs the gate.                                                                          | no      |

The network boundary is the load-bearing part. `upgrade` and `install` reach the network. `generate`,
`generate --check` and `check` never do. So a lint run never fails because a registry is slow. It also never
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
  language:<new>        would claim 14 files currently reported as unchecked
  framework:express  would add 7 checks to scope api

settings schema
  ok    version 1 unchanged, every setting in gspot.toml still exists

coverage change
  + 23 paths newly claimed   (14 .toml by the taplo schema check, 9 .js by types)
  - 0  paths lose coverage
  ! 0  paths change status for the worse

action required on upgrade
  4 new baselines
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

A rule that arrives with findings enters the baseline with a measured count, per [09-gates.md](09-gates.md). The gate passes on the
day of the upgrade and the count can only fall.

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
 .gspot/baseline/*.json            4 +       new baselines
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

`language:<new>` arriving in 0.3.0 changes nothing for a repository that has none of that language. For a repository
that does have Go, those files were **already** reported as unchecked before the upgrade, so the
coverage check was already failing or the paths were already declared. The upgrade report says what
the new preset would claim, and enabling it is a separate, deliberate commit:

```text
$ gspot upgrade --check
language:<new>        14 files match, currently: 14 unchecked
framework:express  detected: express in api/package.json

$ add `language:<new>` to `presets` and run `gspot generate`
```

Adding a preset edits nothing but the `presets` array, then runs `generate` and reports the new
findings, and `generate` writes baselines for the new area the same way `init` does.

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
| `gspot generate`   | Re-assemble from the current version and selection                |
| `gspot report --rules` | Per file: layer, preset, enforced statements, unenforced statements |

An edit to a generated rule file fails `gspot generate --check` on the next run, with the diff and the two
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
it and `gspot generate --check` fails on the next run. Any automation that bumps the
version must run `gspot upgrade` in the same change and commit what it wrote.
gspot does not ship that automation. The repository's own tooling does, or a
person does.

### Discovering that an update exists

A gate that phones home is a gate that fails offline. So `gspot check` never checks for updates and
never prints a notice.

Two places report an available version, both of them run by a human:

- `gspot doctor`.
- `gspot upgrade --check`, which is the explicit question.

### Rollback

Downgrading is upgrading with a lower number, and it works because everything that matters is
tracked.

```text
gspot upgrade --to 0.2.1      # re-renders every generated file from 0.2.1
```

Or, for a repository that has committed the upgrade and wants it gone: `git revert` the upgrade
commit and run `gspot generate`. The revert restores the version, the lock, the configs, the baselines,
the coverage check and the corpus together, because they landed together.

Two constraints on a rollback, both stated rather than papered over:

1. **A baseline written by a newer version stays.** Reverting the version leaves a baseline file for
   a rule that no longer exists, and `gspot generate --check` reports it as orphaned so it gets deleted
   deliberately.
1. **A setting added for a newer version fails the older load.** The message names the setting
   and the version that introduced it. Removing the setting is the fix, and it is a visible edit to
   `gspot.toml`.

### Where the report comes from

The upgrade report is computed, not authored. Added, removed and stricter rules come from diffing
the two versions' preset manifests. Renamed and removed settings come from the load failure that
names them. `CHANGELOG.md` is prose for humans and drives nothing.
