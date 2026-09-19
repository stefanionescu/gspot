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
- Where the tool has no include form, no root file is written.
- No new setting comes with this. The nine `copy = true` stubs leave their manifests.
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

The git stash `hooks-existing` of this repository holds a first form of this
(`hooks.tool = "shared"`). It follows the design except for the last two points, and its name changes:
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
  to it. `gspot check --stage manual` runs it.
- The pre-push hook runs the push stage over the scopes that hold a changed file, measured from
  the merge base.
- `gspot check` with no flag still runs everything, and says how long each stage took.
- init runs no check (D-165). It installs the tools and ends, and its last lines name
  `gspot check`.
- A cache key holds the hash of the configuration files the check names, not of all of
  `.gspot/`. The generated hash is computed once for each run.
- The Swift build folder moves to the cache folder of the platform. The verdict cache stays in
  `.gspot/cache/` and drops entries older than 30 days.

## A-5 The first commit fails, so a skip file hid it

**Evidence.** `NEVER_BASELINED` in `run/baselines.ts` holds `format`, `syntax`, `schema`,
`coverage` and `build`. A repository with one unformatted file fails its gate from the first
commit after init. In the app an untracked `gspot.local.toml` skips eight checks, so the gate
passes on one machine and fails on every other. `GSPOT-MIGRATION.md` says so, and
still opens its results with the words `0 fail`. The debt it lists is small: 87 findings in 69 files, which
one fix run clears.

**Design (D-103, D-165).**

- gspot has no baseline, and init runs no check. Its last lines name `gspot check --fix`, and the
  developer runs it when they want.
- `gspot.local.toml` keeps one purpose: a tool that cannot run on this machine. A skip of a
  check whose tool is present is refused.
- Every summary line counts the checks a local skip removed.

## A-6 One baseline file for each rule

**Evidence.** `.gspot/baselines/` in the app holds 112 files, 928 KB. Each file holds the count
for one rule and a map of every path to its count. `applyBaselines` keeps every finding of a
rule when its count rises, so one new `explicit_acl` finding prints 5,894 findings. Two
branches that touch the same rule change the same path map and conflict at merge.

**Design (D-165).** The owner decided on 2026-09-19 that gspot has no baseline. The 112 files go,
and nothing takes their place. `gspot check` reports what it finds today, the hooks check the
files a change touches, and `git commit --no-verify` passes a hook.

## A-7 The run record loses the run that matters

**Evidence.** `writeRecord` writes `.gspot/last.json` on every run. The `commit-msg` hook is a
run. In the app, `last.json` holds one check, `commits/commitlint`. `apply --lower-baselines`
reads that file, so a commit between a full check and the lowering leaves it nothing to read.

**Design (D-105).** One condition in `run/execute.ts`: a run of the `message` stage writes no
report. The file stays one file in one place, under the name [19-names.md](19-names.md) gives it,
`.gspot/report.json`. `gspot doctor` reads it for the date of the last full run.

## A-8 One policy file, written badly

**Evidence.** The app's `gspot.toml`: line 8 is 330 characters and line 14 is 640, both inline
tables. 36 `[[tools.gitleaks.baseline_reasons]]` entries hold one sentence with a different
commit in it. `policy/propose.ts` says why: the TOML patcher refuses a document where one scope
holds an inline table and another holds a sub-table, so every scope setting is written inline.

**Design (D-106).** One policy file stays, and nothing moves out of it.

- A scope setting is written as a sub-table, `[scope.tools.trivy]` under its `[[scope]]`. The
  writer is fixed or replaced so that both forms load.
- One reason can cover many entries: `[[tools.gitleaks.baseline_reasons]]` takes `commits = [...]`
  or `paths = [...]` with one `reason`.
- init writes the policy in a fixed order: selection, scopes, settings a person chose, then
  exceptions. A comment line opens each group.

## A-9 Two files named `gspot.toml`

**Evidence.** The config is `gspot.toml`. The mise file is `.config/mise/conf.d/gspot.toml`. Four
source files hold that path.

**What is forced.** mise loads extra files only from a `conf.d` folder: `mise/conf.d/`,
`.mise/conf.d/`, or `.config/mise/conf.d/`. A file of its own is the one way gspot adds pins and
tasks without editing the `mise.toml` of the developer. The folder `.config/` and the file name
were choices.

**Design (D-127).** The file is `.mise/conf.d/gspot-tools.toml`, in every repository.

## A-10 Takeover misses tasks, and deletes files it does not own

**Evidence.**

- `repository/existing-tooling.ts` reads mise files and never `.mise/tasks/`. The app held lint
  tasks there. They were deleted by hand. Another person gets dead tasks and no line in the
  plan.
- `CONVENTIONAL_CONFIG_PATHS.sqlfluff` holds `setup.cfg` and `tox.ini`. With the `sql` preset
  selected, `collectCarried` puts both on the removed list, and `deleteReplaced` deletes them.
  A Python project keeps its package metadata and its test environments in those files.
- `uninstall` removes `.gspot/` and the stubs. It does not say which commit holds the files
  takeover deleted.

**Design (D-109).**

- A file that more than one tool reads is never deleted: `setup.cfg`, `tox.ini`,
  `pyproject.toml`, `package.json`. Takeover reads the one section and names it in the plan as
  `remove by hand`.
- Task files count as tooling: `.mise/tasks/**`, `package.json` scripts, `Makefile` and
  `justfile` targets that call a tool gspot now owns. The plan lists each one. gspot edits none
  of them.
- `uninstall` prints the commit that init started from, which holds every deleted file.

## A-11 Scopes come from workspaces only

**Evidence.** `workspaceScopes` reads npm workspaces, the uv workspace, and the Cargo workspace. The Cargo
reader goes with the rust preset (D-136).
The app has `api/`, `supabase/` and `ios/`. `ios/` is no workspace member, so the install
needed three hand-typed `--scope` flags. A repository with a Swift folder or two
independent `package.json` files gets no scope.

Scope files land in two places. `targetInScope` puts a per-scope target under
`.gspot/<scope>/` when the target starts with `.gspot/`, and inside the scope folder when it
does not. The stub goes into the scope folder in both cases.

**Design (D-108).**

- init proposes a scope for every folder that holds a project file: `package.json`,
  `pyproject.toml`, `Package.swift`, `*.xcodeproj`. A
  workspace member list still wins where one exists.
- One rule for scope files: generated configuration lives under `.gspot/<scope>/`, and only a
  pointer stub lives inside the scope folder. [12-repository-layout.md](12-repository-layout.md)
  states it, and the init plan prints both paths.

## A-12 The install depends on one machine

**Evidence.** The app's `package.json` holds
`"@gspot/eslint-plugin": "file:../gspot/packages/eslint-plugin"`. The hooks fall back to
`mise exec -- gspot`, and no gspot release exists for mise to install.

**Design (D-145, D-158).** The plugin is a tool of gspot and installs under `.gspot/`, so the
`package.json` of the app holds no such line. Before the first release, `gspot install` takes the
plugin and the launcher from the local registry of the test harness, which `GSPOT_REGISTRY`
names. No tracked file holds a path of one machine. The branch still cannot merge before the
first release.

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

**Design (D-110).** A preset marks each opt-in rule `recommended` or `all`. `recommended` holds rules that
find defects. `all` adds rules of taste, such as explicit access control on every
declaration. The `level` key of D-119 selects the group. Today `[inspection] strict`, which
init writes, changes nothing in the Swift preset.

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
  `frameworkNames` tests for the preset name `nestjs`.
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
JavaScript, Python, Swift, Bash, and SQL. `naming/extract.ts` holds five extractors. Go, Rust and Ruby shipped as presets with no table and no extractor, and are deleted (D-136). Nothing tells the person that names in those files go unchecked.

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

## What a repository already has

Five of the six reference repositories share one setup. ComfyUI-Pixaroma has no hooks and no
tasks, so gspot owns everything there. The sections A-16 to A-20 are what the other five show.
Each design below changes how init plugs in. None adds a file or a setting.

| What the developer has                                   | Where                                                                   | What gspot does today                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A hook of one line that calls a task                     | `.githooks/pre-commit`: `exec mise run hook:pre-commit`, in all five    | takes the hooks path, or adds a block beside the old lint call     |
| A setup task that sets the hooks path                    | `.mise/tasks/setup`: `git config core.hooksPath .githooks`, in all five | sets the path to `.gspot/hooks`, and the next setup run reverts it |
| Commands in the README and in muscle memory              | yap-landing: `bun run lint`, `bun run format`, `mise run lint:shell`    | adds `gspot:check` beside them and leaves the old names dead       |
| Tool tables in `pyproject.toml`                          | `[tool.ruff]`, `[tool.deptry]`, `[tool.vulture]` in three repositories  | reads `ruff.toml` only, so the editor and the gate disagree        |
| Lint dependencies, a `quality` workspace, duplicate pins | 31 devDependencies in yap-landing, `"workspaces": ["quality"]`          | lists the folder, and names neither the packages nor the workspace |
| Variables that skip a hook                               | `SKIP_HOOKS=1`, `SKIP_COMMITLINT=1`                                     | nothing, and the failure text names no way out                     |
| No CI                                                    | none of the six has a workflow                                          | the hooks are the whole gate, so A-4 decides the experience        |

## A-16 The hook calls a task, so the task is where gspot goes

**Evidence.** In all five repositories the hook file holds one `exec mise run ...` line, and the
work is in `.mise/tasks/hook/pre-commit`, which sources `quality/repository/hooks/lib.sh`. A
gspot block in the hook file (D-101) runs beside a task that still calls the deleted lint
folder.

**Design (D-114).** init reads what the hook calls. Where the hook calls a task or a script,
that file is where the gspot line goes. The plan shows the file, the lines that leave, and the
line that arrives. The order is: the task the hook calls, then the hook file, then the
hooks of gspot where a repository has none. Lines in the task that are not lint, such as the
LFS call and the guard for production environment files, stay.

## A-17 The hooks path is local, and the setup task owns it

**Evidence.** `core.hooksPath` is git configuration of one clone. Every reference repository
sets it in its setup task. A person who clones a gspot repository has no hooks until they run
`gspot apply`, and nothing says so. Where gspot takes the path, `mise run setup` takes it back.

**Design (D-115).**

- gspot never sets `core.hooksPath` in a repository where a tracked file sets it.
- `gspot install` sets up one clone: the tools and the hooks (D-156). With a yes, init adds that
  one line to the setup entry the repository has: the setup task, the `prepare` script, or a
  Makefile target. The plan shows the line.
- `gspot doctor` and `gspot check` say when the policy names hooks and this clone runs none, with
  the command that fixes it.

## A-18 The commands people type keep working

**Evidence.** The README of yap-landing lists `bun run lint`, `bun run format`,
`bun run format:check`, and `mise run lint:shell`. `runner-surface.ts` writes five `gspot:*`
tasks and knows nothing about the names a repository has.

**Design (D-116).** Where a `lint`, `format`, or `format:check` task or script exists, init
proposes its new body: `gspot check`, `gspot check --fix`, and `gspot check formatting/prettier`.
The plan shows each one before and after. gspot writes a `gspot:*` task only where no such name
exists. Narrow names that lose their meaning, such as `lint:shell`, are listed for the person to
delete. The plan ends with what changes for the team: the commands that stay, the commands that
go, and what a teammate runs after pulling.

## A-19 Configuration inside a shared manifest

**Evidence.** Three repositories keep about 100 lines of `[tool.ruff]` in `pyproject.toml`,
beside `[tool.deptry]`, `[tool.vulture]`, `[tool.importlinter]`, and tables that are no lint at
all, such as `[tool.comfy]`. `carry.ts` reads `ruff.toml` only. After init the gate reads
`.gspot/ruff.toml` and the editor reads `pyproject.toml`. The same holds for the `prettier`,
`eslintConfig`, `commitlint`, and `lint-staged` keys of `package.json`.

**Design (D-117).** Takeover reads these tables the way it reads a configuration file, and
carries the disabled rules and the exception lists. gspot never edits the manifest. The plan
names the table and its lines under `remove by hand`, and `gspot doctor` reports a tool that has
two configurations until the table is gone. Lint-only dependencies, a workspace entry for a lint
folder, and duplicate pins are listed the same way, each with the command that removes it.

## A-20 The way out of a failing hook

**Evidence.** The hooks of the reference repositories honor `SKIP_HOOKS=1`. A gspot hook that
fails prints the findings and nothing else.

**Design.** No new variable. The last line of a failing hook run names
`git commit --no-verify` and `gspot check --staged`, which reproduces the failure. Where the hook
of the repository keeps running (A-16), its own variables keep working.

## Making it yours

A developer who meets 49 presets and 250 checks asks three things. What exists? How does a
person take only some of it? How does a choice travel to the next repository? Most of the answer
exists, and none of it is shown.

| A developer wants to                  | Today                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Install only some presets             | `init --presets a,b`, `--without c`, `--scope path=a,b`, `--no-checks`               |
| Turn one check or one rule off        | `gspot ignore <check> --rule <rule> --reason "..."`, for some paths with `--paths`   |
| Turn it back on                       | `gspot ignore <check> --rule <rule> --remove`                                        |
| Drop one tool                         | `gspot ignore <check> --reason "..."` for each check of the tool (D-160)             |
| Add or drop a preset later            | `gspot add <preset>`, `gspot remove <preset>`                                        |
| Add a check of their own              | a `[[check]]` entry in `gspot.toml` that runs any command                            |
| Carry the setup to another repository | `gspot export team.toml`, then `gspot init --from team.toml`, a URL, or `github:o/r` |
| Commit or push past a failing hook    | `git commit --no-verify`, `git push --no-verify`                                     |
| See what exists before choosing       | `gspot list` (D-118)                                                                 |
| Take the basics only                  | the default: `level = "recommended"` (D-119)                                         |

## Every path a developer takes

Each row names the decision that answers it. A row marked open has a gap row in
[18-gaps.md](18-gaps.md).

| The developer                                                             | What happens                                                                                                             | Decided by                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| has an empty repository                                                   | init installs what reads no language; `gspot check` names a language that arrives later, with the `gspot add` line       | D-125                               |
| has a folder that is no git repository, or another version control system | init says so, proposes no preset that needs git, and scans secrets by files; the git flags exit 2 with one sentence      | K-214, K-271                        |
| has a repository with no linting                                          | init proposes presets in three groups, installs `recommended`, runs no check, and the hooks check what a change touches  | D-119, D-120, D-165                 |
| has linting, hooks, and tasks of their own                                | hooks and tasks are added to, never replaced; old config is carried in both directions; every file not carried is listed | D-101, D-109, D-114 to D-117, K-193 |
| has a monorepo                                                            | one scope for each project file; one `gspot.toml`; a check reads the files of its scope                                  | D-108, K-149                        |
| wants some presets only                                                   | the three questions, or `--presets` and `--without`                                                                      | D-120                               |
| wants everything later                                                    | `gspot list`, `gspot add`, `gspot set level all`; the new checks are on from the next run                                | D-118, D-160                        |
| wants one rule off, back on, or one check above the level on              | `gspot ignore` with a reason, `--remove`, and `gspot set extra_checks`                                                   | D-160                               |
| wants to change a limit                                                   | `gspot set limits.<name>`, with a reason when it loosens; the number holds in every framework                            | D-138                               |
| wants a check of their own                                                | a `[[check]]` entry that runs any command                                                                                | 03-configuration.md                 |
| wants the same setup in the next repository                               | `gspot export`, then `gspot init --from` a file, a URL, or `github:owner/repo`                                           | D-161                               |
| adds a language or a framework later                                      | `gspot check` names it; `gspot add` selects it; its checks are on from the next run                                      | D-125                               |
| meets a finding                                                           | `gspot explain`, `gspot check --fix`, or `gspot ignore`                                                                  | D-131                               |
| must commit past a failing hook                                           | `--no-verify`; the failure text names it, and the push and CI still check                                                | D-117, D-123                        |
| clones the repository on a new machine                                    | `gspot install`, alone or through the setup entry; a clone that is not set up says so on every run                       | D-156                               |
| upgrades gspot                                                            | `gspot upgrade` prints what changes; new rules are on from the next run                                                  | D-165                               |
| works on GitLab, also self-hosted                                         | `--ci gitlab` writes `.gitlab/ci/gspot.yml` with a code quality report; the system is found by its file                  | D-133, K-277                        |
| works on another CI system                                                | no file; the plan prints the three lines to paste, and one guide shows them                                              | K-278                               |
| uses the pre-commit framework, lint-staged, or simple-git-hooks           | the gspot line goes into the hook tool the repository has                                                                | K-275                               |
| uses Cursor, Copilot, or Gemini                                           | the index of rule files goes into each agent file the repository holds                                                   | K-279                               |
| keeps their own ESLint and Prettier for now                               | both run; the plan prints the ignore line each of their tools needs                                                      | D-145, K-268                        |
| sits behind a private registry or a proxy                                 | the install under `.gspot/` takes the registry settings of the repository                                                | K-267                               |
| has the config below the git root                                         | checks run from the config root, and the hook changes folder first                                                       | K-272                               |
| has no commit, no remote, or a shallow clone                              | each has one stated behavior and one planted case                                                                        | K-272                               |
| works on Windows, or in an Alpine image                                   | LF line ends for `.gspot/`, the Windows job of CI, and two musl targets                                                  | K-263, K-273, K-280                 |
| merges two branches that changed the config                               | `gspot apply` and `gspot install` write the generated files again                                                        | K-274                               |
| leaves                                                                    | `gspot uninstall` removes what gspot wrote; git holds the old files                                                      | D-109                               |

## A-21 Nobody can see the menu

**Evidence.** `gspot explain <subject>` needs a name the person already knows. `gspot doctor
--settings` prints settings, not checks. No command prints the presets and checks that exist,
which are installed, and which are off.

**Design (D-118).** `gspot list` prints the presets in three groups: languages, frameworks, and
concerns. Under each installed preset it prints the checks with a state: on, off with the
reason, off by level, or waiting for a setting. `gspot list <preset>` prints one preset. `--json` prints the
same for an agent. The data is what `explain` and the manual already read.

## A-22 A preset is all or nothing

**Evidence.** A preset is selected whole. `[inspection] strict = false` is written by init and
read by almost nothing (K-52). Ruff ships a small default set, and Biome and ESLint ship
`recommended` beside a fuller set, because a first run that prints 23,000 findings ends the trial.

**Design (D-119).** Two levels, the words ESLint and Biome use: `recommended` and `all`. Every check and every
opt-in tool rule carries one. `recommended` finds defects. `all` adds taste, style beyond the
formatter, and documentation rules.

init writes `level = "recommended"`, and `level = "all"` turns the rest on. The second level
is not called `strict`: TypeScript and JavaScript already own that word.

The banned terms of the naming policy are `recommended`
and stay on.

## A-23 The init question is one list of 52

**Evidence.** `askPresets` in `lifecycle/questions.ts` shows one multiselect of every proposed
preset.

**Design (D-120).** Three short questions in place of one: the languages found, the frameworks
found, and the concerns, each item with its one-line description and the number of checks it
brings. Found items start ticked. `--yes` behaves as it does today.

## A-24 What works and is never said

Bypassing a hook, turning a rule back on, a check of your own, and profiles all work today.
No guide, no help text, and no README line mentions any of them. This is a documentation gap,
and [21-documentation.md](21-documentation.md) owns it.

## A-25 The agent file grew from 372 bytes to 21 KB

**Evidence.** Before the install, `CLAUDE.md` in the app held five lines. After it, `CLAUDE.md`
and `AGENTS.md` hold 21,244 bytes each, and an agent loads the file in every session. The block
is a table of 56 rule file paths, and the formatter pads every row to the widest one, 570
characters. Most of the file is spaces.

**Design.** The managed block lists each area with its files as a plain list, one path on each
line, with no table. It names the rule files of the presets that are selected for the files an
agent is likely to touch, and points at `.gspot/rules/` for the rest.

## A-26 A pull request shows the generated files as code

**Evidence.** `.gitattributes` in the app holds no line for `.gspot/`. A pull request that
lowers a baseline or upgrades gspot shows every generated file in its diff, with 928 KB of
baseline JSON. GitHub also counts them in the language bar.

**Design.** init adds one managed block to `.gitattributes`: `.gspot/** linguist-generated`.
The natures code of gspot already reads that attribute.

## Whether a developer keeps it

Not today. The reasons, in the order a developer meets them:

1. init takes 35 minutes and prints 23,000 findings.
2. Their hooks stop running.
3. The first commit fails on formatting.
4. The root holds 14 new files, and two of them do not say who wrote them.
5. The push takes 45 minutes.
6. The first merge conflicts in `.gspot/baselines/`.

The order of work in [13-roadmap.md](13-roadmap.md) follows that list.
