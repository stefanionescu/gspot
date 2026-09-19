# Adoption

This document records what the install in yap-swift-app showed, and the design that answers each
defect. The install is on branch `chore/gspot` of that repository (D-97). Read on
September 19, 2026. Each section names the evidence, so a reader can run the same command and
see the same result.

The decisions are D-100 to D-113 in [14-decisions.md](14-decisions.md). The
code gaps are in [18-gaps.md](18-gaps.md). A section leaves this document in the commit that
closes it.

The test for every design below is one question: does a developer who did not write gspot keep it
installed after the first week?

## What the install looks like

| Measure                                  | Value                                                 |
| ---------------------------------------- | ----------------------------------------------------- |
| Generated files at the repository root   | 14                                                    |
| Baseline files under `.gspot/baselines/` | 112, 928 KB                                           |
| `.gspot/cache/`                          | 7.1 GB, of which the Swift build folder is nearly all |
| `gspot.toml`                             | 392 lines                                             |
| `init`                                   | about 35 minutes                                      |
| `gspot check`, which pre-push runs       | about 45 minutes                                      |
| Findings on the first run                | about 23,000                                          |
| Checks skipped on one machine only       | 8, through an untracked `gspot.local.toml`            |

## A-1 The root holds copies

**Evidence.** Nine stubs in seven manifests declare `copy = true`: `.gitleaks.toml`,
`osv-scanner.toml`, `typos.toml`, `.yamllint.yml`, `.taplo.toml`, `.v8rrc.yml`, `.shellcheckrc`,
`.prettierrc.json` and `.swiftformat`. `diff .gitleaks.toml .gspot/gitleaks.toml` prints nothing
in the app, and the same holds for the other three files compared. `emit/targets.ts` writes the
whole generated file a second time (`copyStubContent`).

**Why it is wrong.** [03-configuration.md](03-configuration.md) says a stub is a one-line file
that points an editor at `.gspot/`. A copy is two sources for one configuration. The root of the
app holds more lint files after the install than before it, which is the opposite of the pitch.
Every check passes `--config` itself, so gspot needs none of these files.

**Design (D-100).**

- A root file exists only for a tool that an editor or a person runs without gspot, and that
  cannot be told where its configuration lives.
- Where the tool has an include form, the root file is a pointer: `extends`, `inherit_from`,
  `parent_config`, a re-export. Eight stubs already work this way.
- Where the tool has no include form, no root file is written. `gspot.toml` gains
  `[editor] root_files = ["typos", ...]` for a person who wants the copy, and the default is
  none.
- The init plan lists every root file with the reason it exists.

## A-2 A stub that does not say where it came from

**Evidence.** `.prettierrc.json` and `.commitlintrc.json` in the app hold no marker.
`copyStubContent` deletes the `_gspot` key from a JSON copy, and a `body` stub that ends in
`.json` gets no header, because JSON has no comment.

**Design (D-100).** Every file gspot writes carries its mark. A JSON file keeps the `_gspot` key
where the tool accepts an unknown key. Where the tool refuses one, the file is a `.jsonc`,
`.cjs` or `.yml` form that the tool also reads and that takes a comment. `gspot doctor` lists
every file gspot owns, so a person can ask instead of guess.

## A-3 gspot takes the hooks

**Evidence.** `installHooksPath` in `emit/hooks.ts` sets `core.hooksPath` to `.gspot/hooks`.
`hooksDefault` in `lifecycle/questions.ts` answers `gspot` for every repository without husky or
lefthook, so a `.githooks/` folder stops running. The plan prints one line about it, and `--yes`
accepts it. In the app, `.githooks/` was deleted by hand before init.

A second defect sits beside it: `HOOK_DIRECTORIES` in `config/patterns.ts` holds the name
`hooks`. A root folder named `hooks`, which a React project has, reads as a git hooks folder.

**Design (D-101).**

- A repository with hooks keeps them. gspot adds one managed block to each hook file it needs,
  in the folder git already runs, and leaves `core.hooksPath` alone.
- gspot owns the hooks path only in a repository with no hooks at all.
- A folder counts as a hooks folder when `core.hooksPath` names it, or when its name is
  `.githooks`, `.git-hooks` or `.husky`. The bare name `hooks` leaves the list.
- The hook line calls the pinned gspot through the runner and needs no environment variable.
  `GSPOT_BIN` stays a development switch and leaves the generated text.

The working tree of this repository holds a first form of this (`hooks.tool = "shared"`),
uncommitted. It follows the design except for the last two points, and its name changes:
`shared` says nothing about who shares what. The value becomes `existing`.

## A-4 The gate takes 45 minutes

**Evidence.** `check-command.ts` runs stage `all` when no flag names one, and the pre-push hook
runs `gspot check`. Stage `all` means every commit check and every push check over the whole
repository. 48 checks declare `push` and five declare `manual`. In the app that includes `swift/build`, `swift/swiftlint-analyze`,
`swift/periphery` and `xctest/coverage`. `first-check.ts` runs the same set at init with the
cache off.

Two defects make it slower than it needs to be:

- `generatedHash` in `run/execute.ts` hashes every file under `.gspot/` once for each planned
  check, and the hash is part of every cache key. A lowered baseline or a changed rule file
  clears the cached verdict of every check, the Xcode build included.
- `.gspot/cache/` has no size limit and no eviction. The app holds 669 entries.

**Design (D-102).**

- The `manual` stage holds checks that build, test, or scan a whole project. It exists today
  and five checks use it. `swift/build`, the analyzer, periphery, and the coverage checks move
  to it. The CI workflow runs it, and so does `gspot check --at manual`.
- The pre-push hook runs the push stage over the scopes that hold a changed file, measured from
  the merge base.
- `gspot check` with no flag still runs everything, and says how long each stage took.
- init runs the commit stage, writes baselines, and ends. It prints the command that runs the
  other stages and baselines them (`gspot apply --baseline --at manual`).
- A cache key holds the hash of the configuration files the check names, not of all of
  `.gspot/`. The generated hash is computed once for each run.
- The cache moves out of the repository, to the cache folder of the platform, keyed by the
  repository path. It has a size limit, and the oldest entries leave first.

## A-5 The first commit fails, so a skip file hid it

**Evidence.** `NEVER_BASELINED` in `run/baselines.ts` holds `format`, `syntax`, `schema`,
`coverage` and `build`. A repository with one unformatted file fails its gate from the first
commit after init. In the app an untracked `gspot.local.toml` skips eight checks, so the gate
passes on one machine and fails on every other. `GSPOT-MIGRATION.md` reports "0 fail" for a run
that skipped them.

**Why the rule stays.** A baseline of format findings never shrinks, because nobody fixes a
format finding by hand.

**Design (D-103).**

- init ends with an offer: run the fixers and commit the result as one commit that touches
  layout only. The plan shows the number of files. With `--yes` the fixers run, and the commit is
  left to the person.
- Until that commit exists, the format checks report and do not fail. The policy records this
  as `[adoption] format_pending = true`, in the tracked file, so every machine agrees. `gspot
doctor` reports the key, and the first clean format run removes it.
- `gspot.local.toml` keeps one purpose: a tool that cannot run on this machine. A skip of a
  check whose tool is present is refused.
- A run record says how many checks a local skip removed, in the summary line, in every
  format.

## A-6 One baseline file for each rule

**Evidence.** `.gspot/baselines/` in the app holds 112 files, 928 KB. Each file holds the count
for one rule and a map of every path to its count. `applyBaselines` keeps every finding of a
rule when its count rises, so one new `explicit_acl` finding prints 5,894 findings. Two
branches that touch the same rule change the same path map and conflict at merge.

**Design (D-104).**

- One file, `.gspot/baseline.json`, sorted by check, rule and path, one path on each line, so a
  merge conflict is a line conflict a person can resolve.
- A rise prints the findings in the files whose count rose, and one line for the rest:
  `5,893 more are held`.
- A tool that keeps a baseline of its own keeps its file. The engine learns the name of that
  file from the manifest, not from a pattern in `run/baselines.ts`.
- `apply --lower-baselines` rewrites the one file and prints what fell.

## A-7 The run record loses the run that matters

**Evidence.** `writeRecord` writes `.gspot/last.json` on every run. The `commit-msg` hook is a
run. In the app, `last.json` holds one check, `commits/commitlint`. `apply --lower-baselines`
reads that file, so a commit between a full check and the lowering leaves it nothing to read.

**Design (D-105).** One record for each stage: `last.commit.json`, `last.push.json`,
`last.manual.json`. The `message` stage writes none. The records live beside the cache, outside
the repository, and `--json` still prints the record. The `.gitignore` block shrinks to one
line for `gspot.local.toml`.

## A-8 One policy file, written badly

**Evidence.** The app's `gspot.toml`: line 8 is 330 characters and line 14 is 640, both inline
tables. 36 `[[tools.gitleaks.baseline_reasons]]` entries hold one sentence with a different
commit in it. `policy/propose.ts` says why: the TOML patcher refuses a document where one scope
holds an inline table and another holds a sub-table, so every scope setting is written inline.

**Design (D-106).** One policy file stays: a second file means a reader never knows which one
wins.

- A scope setting is written as a sub-table, `[scope.tools.trivy]` under its `[[scope]]`. The
  writer is fixed or replaced so that both forms load.
- A list of exceptions that a tool produces, not a person, lives beside the policy:
  `.gspot/exceptions/<tool>.toml`. The policy names it: `tools.gitleaks.baseline_file`. The
  gitleaks fingerprints, the carried ignore paths, and the advisory ignores move there.
- One reason can cover many entries: `[[tools.gitleaks.baseline_reasons]]` takes `commits = [...]`
  or `paths = [...]` with one `reason`.
- init writes the policy in a fixed order: selection, scopes, settings a person chose, then
  exceptions. A comment line opens each group.

## A-9 Two files named `gspot.toml`

**Evidence.** The policy is `gspot.toml`. The mise surface is `.config/mise/conf.d/gspot.toml`.
The folder is the convention of mise. The file name was a choice.

**Design (D-106).** The mise file becomes `.config/mise/conf.d/gspot-tools.toml`.

## A-10 Takeover misses tasks, and deletes files it does not own

**Evidence.**

- `repository/existing-tooling.ts` reads mise files and never `.mise/tasks/`. The app held lint
  tasks there. They were deleted by hand. Another person gets dead tasks and no line in the
  plan.
- `CONVENTIONAL_CONFIG_PATHS.sqlfluff` holds `setup.cfg` and `tox.ini`. With the `sql` preset
  selected, `collectCarried` puts both on the removed list, and `deleteReplaced` deletes them.
  A Python project keeps its package metadata and its test environments in those files.
- Takeover replaces every owned configuration in one step. No mode runs gspot beside the old
  setup.
- `uninstall` removes `.gspot/` and the stubs. It does not say which commit holds the files
  takeover deleted.

**Design (D-107, D-109).**

- A file that more than one tool reads is never deleted: `setup.cfg`, `tox.ini`,
  `pyproject.toml`, `package.json`. Takeover reads the one section and names it in the plan as
  `remove by hand`.
- Task files count as tooling: `.mise/tasks/**`, `package.json` scripts, `Makefile` and
  `justfile` targets that call a tool gspot now owns. The plan lists each one. gspot edits none
  of them.
- `gspot init --trial` writes `gspot.toml` and `.gspot/`, and nothing else: no root file, no
  hook, no deletion, no runner file. `gspot check` works. `gspot init --finish` does the rest,
  and prints the same plan first.
- `uninstall` prints the commit that init started from, which holds every deleted file.

## A-11 Scopes come from workspaces only

**Evidence.** `workspaceScopes` reads npm workspaces, the uv workspace, and the Cargo workspace.
The app has `api/`, `supabase/` and `ios/`. `ios/` is no workspace member, so the install
needed three hand-typed `--scope` flags. A repository with a Swift folder, a Go module, or two
independent `package.json` files gets no scope.

Scope files land in two places. `targetInScope` puts a per-scope target under
`.gspot/<scope>/` when the target starts with `.gspot/`, and inside the scope folder when it
does not. The stub goes into the scope folder in both cases.

**Design (D-108).**

- init proposes a scope for every folder that holds a project file: `package.json`,
  `pyproject.toml`, `Cargo.toml`, `go.mod`, `Package.swift`, `*.xcodeproj`, `Gemfile`. A
  workspace member list still wins where one exists.
- One rule for scope files: generated configuration lives under `.gspot/<scope>/`, and only a
  pointer stub lives inside the scope folder. [12-repository-layout.md](12-repository-layout.md)
  states it, and the init plan prints both paths.

## A-12 The install depends on one machine

**Evidence.** The app's `package.json` holds
`"@gspot/eslint-plugin": "file:../gspot/packages/eslint-plugin"`. The hooks fall back to
`mise exec -- gspot`, and no gspot release exists for mise to install.

**Design.** No decision is needed. The branch cannot merge before the first release of the
binary and the plugin ([11-toolchain.md](11-toolchain.md)). [17-migration.md](17-migration.md)
lists it as a blocker.

## A-13 Default strictness, outside the banned terms

The shipped banned terms stay as they are. The count that does not come from them:

| Source                                      | Findings held |
| ------------------------------------------- | ------------- |
| SwiftLint `explicit_acl`                    | 5,894         |
| SwiftLint `no_magic_numbers`                | 1,059         |
| `xctest/reference-images` orphan references | 954           |
| SwiftLint `explicit_top_level_acl`          | 826           |
| SwiftLint `one_declaration_per_file`        | 337           |

`presets/swift/swiftlint.yml.tmpl` turns on 95 opt-in rules for every repository.

**Design (D-110).** A preset marks each opt-in rule `core` or `strict`. `core` holds rules that
find defects. `strict` holds rules of taste, such as explicit access control on every
declaration. `[inspection] strict = false`, which init already writes, leaves the strict group
off. Today that key changes nothing in the Swift preset.

## A-14 Sibling files that share a prefix

**The question.** The old `quality` rule counted a name only when it held two or more
underscore parts, so `analysis_prompts` counted and `analysis` did not.

**The answer.** gspot does not repeat that defect: `prefixOf` in `structure/directories.ts`
returns the whole stem when the stem has no separator, so `analysis.ts` beside
`analysis-prompts.ts` is a finding. It has another defect of the same family:

- `prefixOf` cuts at `-` and `.` only. `analysis_prompts.py` beside `analysis.py`, and
  `AnalysisView.swift` beside `AnalysisModel.swift`, share no prefix in its eyes.
- Peers come from every tracked file of the folder. `icon.ts` beside `icon-small.png` and
  `icon-large.png` is a finding that asks the person to move images.
- `TOOL_PREFIXES` and the NestJS names are constants in the analysis, and
  `frameworkNames` tests for the preset id `nestjs`.
- `packages/eslint-plugin/src/files.ts` holds a second copy of `prefixOf`.
- The planted test covers dash names only.

**Design (D-111).**

- The prefix is the first word of the stem, split the way the naming engine splits words
  (`naming/split.ts`): dash, underscore, dot, and case boundary.
- A peer is a file of nature `source` that a language preset claims. Images, data files and
  documents never count.
- A preset manifest declares the file names its framework fixes
  (`[structure] fixed_names = [...]`), and the analysis names no preset.
- The limit for PascalCase languages starts at three, because `UserView` beside `UserModel` is
  the platform convention in a small feature folder.

The rule found two collisions in the app because of the first defect, not because the app is
clean: it holds 724 Swift files with PascalCase names.

## A-15 Naming by language and by framework

**Evidence.** `presets/naming/policy.json` holds case tables for six languages: TypeScript,
JavaScript, Python, Swift, Bash, and SQL. `naming/extract.ts` holds five extractors. Go, Rust and
Ruby ship as presets with no table and no extractor, and their manifests do not recommend
`naming`. Nothing tells the person that names in those files go unchecked.

No framework layer exists:

- TypeScript files must be kebab-case, so `UserCard.tsx` is a finding in every React
  repository.
- The Next.js file names sit in the shared policy, for every `**/app/**` and `**/pages/**`
  folder of every repository.
- `**/hooks/**` exempts git hook names, which also exempts files in a React `hooks/` folder.

**Design (D-112).**

- A framework preset carries a `[[naming.rules]]` table in its manifest. `react`, `vue`,
  `svelte` and `react-native` accept PascalCase for component files. `nextjs` carries the
  Next.js names. `nestjs` carries its `<feature>.<kind>` form. The shared policy names no
  framework.
- `gspot doctor` and the init plan list each language preset with "names: checked" or "names:
  not checked".
- Extractors for Go, Rust, and Ruby are not part of the Adoption phase.

## Whether a developer keeps it

Not today. The reasons, in the order a developer meets them:

1. init takes 35 minutes and prints 23,000 findings.
2. Their hooks stop running.
3. The first commit fails on formatting.
4. The root holds 14 new files, and two of them do not say who wrote them.
5. The push takes 45 minutes.
6. The first merge conflicts in `.gspot/baselines/`.

The order of work in [13-roadmap.md](13-roadmap.md) follows that list.
