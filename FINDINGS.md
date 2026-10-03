# Findings: What to Clean Up in gspot

October 3, 2026. The audit ran in two passes. In the first, twelve audits read the source, the tests, the docs, the
kits, and the repository setup. One more tried gspot in a Python package, a Swift package, a React Native app, and a
monorepo. They found 820 problems.

In the second pass, 28 reviews read every file again, one function, parameter, rule, and sentence at a time. They found
1,885 more problems and corrected some first-pass rows.

This file lists the biggest problems, answers your questions, lists the decisions you need to make, and gives a plan to
fix everything. The details follow by area, then file by file. Each row names the file, the problem, and the fix. Where
a second-pass correction and a first-pass row disagree, the correction wins.

- [The biggest problems](#the-biggest-problems)
- [Answers to your questions](#answers-to-your-questions)
- [Decisions for you](#decisions-for-you)
- [The plan](#the-plan)
- [Diagrams](#diagrams)
- [Findings by area](#findings-by-area)
- [File-by-file review](#file-by-file-review)

Some tool claims come from what the auditors know about those tools, not from runs. The checks section marks them. Check
each one before acting on it.

## The biggest problems

**1. Nobody can install gspot today.** Neither `@gspothq/cli` nor `@gspothq/eslint-plugin` is on npm, and gspot.dev
serves a parked page. Every install command and every docs link fails. In a JavaScript project, `init` stops at "bun
lock resolution failed" and leaves a `gspot.toml` behind, which then blocks a second `init`.

**2. Projects in other languages get JavaScript tooling.** A Python package gets an npm tool project with 8 tools, a Bun
lockfile, and Prettier files at its root. Half of those tools serve no check that runs. A Swift package needs Node.js,
Bun 1.4.2 exactly, uv, Python 3.11, and mise or Homebrew. Only Xcode belongs to its stack.

**3. The docs mislead.** They give three install methods and no rule for choosing one. The README sequence fails at its
second command. No page states the real requirements: uv, and either mise or seven native tools. Python and Swift users
get no path, and several guides describe behavior the code does not have.

**4. One project's choices ship to every user.** Examples are `HF_TOKEN` and `CUDA_MODULE_LOADING` in the naming
allowlist, and the helper names of one application in the Semgrep rules. Others are the folder patterns of one project,
the vocabulary of the gspot docs, and 19 house-style Bash checks. The kits also ban folder names that gspot itself has
to allowlist.

**5. Each module is split across three folders.** The `gspot.toml` of this repository turns on `types_directory` and
`config_directory`. As a result, constants and types live in the mirror trees `config/` (68 files) and `types/` (56
files), away from their code. Of those constants, 84% have one user, and so do 52% of the types. The split breaks a
naming rule that gspot itself ships.

**6. One job has many code paths.** Git is called through about ten entry points. A repository file can be read five
ways, and so can `package.json`. Two modules parse lockfiles. Four checks do one "regenerate and compare" job, and about
15 checks rebuild the generic tool runner.

**7. Thin layers hide the work.** A `check` run passes through about 10 hops. Install has three nested wrappers, and its
dry run keeps its own copy of the install steps. Policy validation runs through five files with near-synonym names.

**8. Names hide what things do.** `execution/tool/` sits beside `tools/`. "Packages" has three meanings, "plan" five,
and "rules" four. `javascript/rules-off` checks that rules are on. "Skip these paths" is the meaning of thirteen
settings, and 18 settings under `tools.` belong to kits that are not tools.

**9. The code has real bugs.** For example, `gspot ignore --remove` reports success when apply fails.
`check --changed main` reads `main` as a path. Level `all` adds no compiler flags, and a symlinked `.gitattributes`
breaks every command. The plan lists them all in phase 1.

The second pass found about 60 more. For example, the Bash checks read `$#` as the start of a comment, and the ESLint
plugin fails beside its own README example.

**10. Many tests prove little.** Five test tiers exist where three run requirements do. The audits found 187 problems in
single tests. They are duplicates across tiers, tests that cannot fail, mocks of internal gspot code, and assertions on
internals. The 41-file harness has five ways to start gspot and a second implementation of `apply`.

**11. The repository carries ceremony.** The pins check runs only by hand, so nothing runs it. The docs workflow cannot
start and cannot deploy. The workflows repeat one flag 31 times, every contributor installs eight test-only tools, and
`gspot.toml` holds about 60 dead lines.

**12. The agent rules repeat the checks.** The second pass read all 86 rule files and found 372 problems in 85 of them.
Rules restate what a shipped check already reports, and one rule appears in three to six files. Kit rules carry the
names of single projects, several contradict the shipped configuration, and many ask for checks an agent cannot run.

## Answers to your questions

### Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist

| File                        | What it does                                                                                                                                                                                        | What to do                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `policy/check-state.ts`     | It holds no policy state. It returns a display string for `gspot list`, and the planner filters checks by comparing that string to `'off (level)'`. It also copies an ignore test from the planner. | Delete it. One status function in the planner returns a cause, and `list` formats it. |
| `policy/json-schema.ts`     | It builds the published JSON Schema of `gspot.toml`. The CLI never imports it; only the docs site and one test do.                                                                                  | Move it to the docs package.                                                          |
| `policy/loosening.ts`       | It decides whether a reason is acceptable and whether a value is weaker than the default. Five callers need it.                                                                                     | Merge it into `policy/problems/reasons.ts`.                                           |
| `policy/normalize.ts`       | It turns the raw TOML into the policy object. It is needed. It also renames keys that `settings.ts` then maps back.                                                                                 | Keep it, and keep the TOML key names.                                                 |
| `policy/setting-surface.ts` | It lists every setting the selected kits declare, with defaults. It is needed, but it was split out of `settings.ts` only to shorten that file.                                                     | Rename it to `policy/settings/known.ts`.                                              |
| `policy/written-keys.ts`    | It lists the keys a table writes. It has one caller.                                                                                                                                                | Merge it into its caller, `policy/problems/keys.ts`.                                  |

### Why there are so many files, why they are not in sensible folders, and why the names are so bad

Three habits caused it. Files were split by length to meet the file-size limit, not by concept. Constants and types
moved into the `config/` and `types/` mirror trees because the `gspot.toml` of this repository turns that layout on.
Renames were done by search and replace: "configuration" became "kit" in the wrong places (`kitName`, `KitDocument`),
and "confined" became "files" in the comments of the file-safety code. The fix is the layout in the
[source diagram](#diagrams), which puts constants and types beside their code, `policy/` in three subfolders, and the
checks in one file per kit. It also applies every merge and rename the area sections list.

### Why `scripts/gspot` is here

The Git hooks run `mise exec -- gspot`. `mise.toml` puts `scripts/` on the mise `PATH`, so `gspot` resolves to
`scripts/gspot`, a two-line file that runs the source CLI. That lets this repository's hooks run the code you are
editing, with no build. Keep it. Delete the `gspot` mise task, which does the same thing a second way.

### Why the repository has `scripts/test-tools.ts`, `.mise/conf.d/test-tools.toml`, and `.mise/conf.d` at all

`.mise/conf.d/` is a product contract: gspot writes its tool pins to `.mise/conf.d/gspot-tools.toml` in every repository
that uses mise, so it never edits your `mise.toml`. `scripts/test-tools.ts` pins eight tools that only the tool and
acceptance suites need, such as Trivy, SwiftLint, and Deno, and reads their versions from the kit manifests. The script
is useful, but its file sits in the folder gspot owns and makes every contributor install those eight tools. Move it to
`mise.test.toml`, loaded with `MISE_ENV=test`.

### What `pins.yml` is for, and why it had a cron

`pins.yml` asks npm, PyPI, crates.io, and GitHub whether every pinned tool release exists. The check is useful; the
weekly cron was ceremony. Pins change only in a commit that edits a manifest, and the workflow never ran. The schedule
is gone, so it runs only by hand. Run the check in CI when a manifest changes, and delete `pins.yml`.

### What the Supabase "database journey" is, and who it is for

`database.yml` runs the tool suite for gspot maintainers, with the one Supabase test turned on. It starts a local
Postgres with the Supabase CLI and checks that `supabase/types-fresh` rejects stale database types. Users never see it.
Its weekly cron repeated the same pinned inputs and never ran. The schedule is gone, so it runs only by hand. Keep it
for manual runs, or delete it.

### Whether the workflows are for gspot itself or templates for other repositories

All five workflows serve this repository only. Users get a generated `.github/workflows/gspot.yml` instead. Keep
`ci.yml` and `release.yml`. `docs.yml` never starts, because the release it waits for is created with `GITHUB_TOKEN`,
and its deploy waits for a variable and a Pages site that do not exist. `release.yml` uses a `$/` form that GitHub does
not document.

### Why `grammars` is plural, and whether to gitignore it

Both are right. The folder holds eight tree-sitter grammars. Seven are copies of npm package files, and one is a
verified download, about 9 MB in all. They are copied because the npm packages compile native code at install. The way
they are produced is not simple: setup downloads one, the build copies seven, and a checkout reads different files
before and after a build. Let setup write all eight, and let the CLI read only `grammars/`.

### Where `HF_TOKEN` and `[[config.selectors]]` come from

`HF_TOKEN` and `CUDA_MODULE_LOADING` are in the shipped `packages/cli/kits/general/naming/policy.json`, not in
`gspot.toml`, so every user inherits names from one machine-learning project. Delete them. `[[config.selectors]]` sit in
the NestJS and React Native kits. Most encode framework-wide practice and belong there. The two NestJS rules that forbid
injecting a repository into a controller are a layering choice for each project.

### Which settings are too specific for gspot and belong to each project

The [kits section](findings/areas/kits.md) lists 154 findings. The main ones are below:

- names from one application in the Semgrep rules, such as `supabaseAuthMiddleware`, `createAdminClient`, and
  `validateRequestJson`
- one project's folders, such as `**/api/src/`, `/shared/**`, and `**/features/*/server/**`
- the docs style of gspot itself: its Vale vocabulary, acronyms such as `NVIDIA` and `GRDB`, and its rule disables
- exceptions for one codebase, such as two WebKit prefixes, `CoreGraphics`, and a chosen license allowlist
- naming groups that cannot be removed and ban common React words such as `fallback` and `newValue`
- the house-style checks: shortest-first ordering, the Bash headers and guards, and the Postgres migration boxes

Move each to the project's own `gspot.toml`, or into an opt-in kit.

### Why the README says "JavaScript or TypeScript" and installs locally and then globally

Both are mistakes. gspot serves any stack, and the README offers two install methods without saying when to use which. A
global install also conflicts with the exact version each repository pins in `.gspot/version`, so one machine can serve
only one version. Choose one method per project type, and say it once:

| Your project                          | Install                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Has `package.json`                    | `npm install --save-dev --save-exact @gspothq/cli`, then `npx gspot init`                   |
| Uses mise, any language               | `mise use gspot`, which pins gspot and every native tool for the repository                 |
| Python, Swift, or other, without mise | A decision for you: mise by default, or a compiled binary through `uvx`, Homebrew, and mise |

The [docs section](findings/areas/docs.md) gives the full README outline, the new docs tree, and 99 findings.

### Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling

| Project                        | What gspot writes today                                                                              | What is wrong                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Python package                 | 57 files, including an npm tool project with 8 tools, a Bun lockfile, and Prettier files at the root | 4 of the 8 npm tools serve no active check. The Prettier files sit at the root of a Python project.                  |
| Swift package                  | 56 files, the same JavaScript files, and a Python project only to run yamllint                       | `gspot install` installs 8 of 21 tools. Doctor says "Run: gspot install" for tools install never installs.           |
| React Native app               | `init` failed at lock resolution                                                                     | The ESLint config declares Node.js globals. The agent rules say `Buffer` exists. Expo tools are pinned without Expo. |
| TypeScript and Python monorepo | `init` failed at lock resolution                                                                     | Scoping is right: JavaScript checks stay in `apps/web` and Python checks in `services/api`.                          |

The fix has two parts. First, pin only the tools of checks that run, and avoid Node.js tools for non-JavaScript files.
Second, ship gspot so that a Python or Swift developer needs no Node.js.

### Whether gspot needs a Python or other implementation

No. Keep one TypeScript implementation and fix how it ships:

- **Size:** a second implementation repeats 39,306 lines, 53 kit manifests, 77 templates, and 428 test files.
- **Templates:** the kit templates contain JavaScript expressions, so another language cannot reuse them.
- **Byte-identical output:** gspot compares generated files against stored hashes. Two implementations must produce the
  same bytes. Otherwise, teammates see each other's files as changed.
- **Mixed repositories:** a monorepo with a web app needs Node.js for ESLint anyway.

What Python and Swift developers object to is installing Node.js. A binary built with `bun build --compile` and shipped
through npm, PyPI, Homebrew, and mise removes that. This reopens your September 29 decision against per-platform
binaries, so it is listed under decisions.

### Why `tests/tools` has a `cli` folder, why acceptance and integration exist, what samples are, and how to group tests

- **`tests/tools/cli`:** the `cli` level was copied from `tests/unit`, which tests two packages. `tests/tools` holds
  nothing but `cli/`, so the level adds nothing. `tests/integration/cli` and `tests/harness/cli` repeat it.
- **Acceptance and integration:** the five tiers are ceremony. Only three run requirements exist: no tools, pinned tools
  with a local registry, and a built package.
    - Unit and integration run in one task and one CI job, and only 43 of 188 integration files run the CLI in-process.
    - Tools and acceptance run in one CI job with the same shards.
- **Samples:** they are planted text that tests write into sandboxes. Three files are worth keeping. The rest repeat
  strings, have one user, or copy a harness file.
- **Grouping:** use one folder per suite: `tests/cli` and `tests/plugin` (fast, no tools), `tests/tools` (pinned tools),
  and `tests/packages` (the built release). Inside each, mirror the source. Keep one flat `tests/harness` for shared
  helpers. Test types sit beside the test or helper that uses them, not in the harness.

### Which tests are fake

The audits read every test file and found 187 problems in single tests. These are the patterns:

- the same behavior tested in two or three tiers, such as the typos partial fix and `bash/syntax`
- tests that cannot fail: a value compared with itself, a row that repeats another row, checks for files nothing writes,
  and a test of a cache that does not exist
- acceptance tests that install a whole sandbox to test the built-in checks of gspot, which need no native tool
- mocks of internal gspot functions instead of the process boundary, and assertions on call counts, argv copies, and
  internal fields
- timing races, and whole message sentences pinned where no contract fixes the wording
- many rows that hit one branch, each one running gspot again

Delete the duplicates and the tests that cannot fail. Move each test to the cheapest suite that can run it. Assert
behavior and public output, and mock only the process boundary. The [test sections](findings/areas/unit-tests.md) list
every case.

### What else in this repository, or in what gspot installs, is junk

- Prettier files at the root of Python and Swift projects, and `syncpack` and `commitlint` configurations where nothing
  runs them
- Vale style folders in `.gitignore` when the prose kit is not selected
- an ESLint level table of 1,577 entries, of which 1,274 are never read, written into every generated ESLint config
- `eslint-plugin-jsx-a11y` loaded in React Native with all 39 of its rules off
- a SwiftFormat configuration that enables 19 rules and then disables them
- an ESLint plugin built three to five times in every CI job
- development tasks that import the test harness, which is the wrong direction

## Decisions for you

Each decision blocks part of the plan. The recommendation comes first.

### Product

**1. Install for non-JavaScript projects.** Recommended: ship a compiled binary through npm, PyPI (`uvx`), Homebrew, and
mise, and make mise the default runner when it is installed. Alternative: keep npm only and document mise.

**2. Node.js tools in Python and Swift projects.** Recommended: none. Replace Prettier, markdownlint, and v8r there with
native tools, or drop those checks for those stacks.

**3. House-style checks.** Recommended: move them out of the shipped kits into an opt-in kit. This covers shortest-first
ordering, the Bash contract, the migration boxes, the README template, banned folder names, and the naming groups.

**4. One-project defaults.** Recommended: delete them from the kits: `HF_TOKEN`, one application's helpers, one
project's folders, and the gspot docs vocabulary.

**5. The level `all`.** It is not "all checks": experimental rules stay off. Recommended: keep the name. Make sure each
level adds what it promises, starting with the compiler flags.

**6. Breaking renames.** Many setting and check names change. Recommended: break them now, before the first release.

### Code

**7. `types_directory` and `config_directory`.** Recommended: gspot stops using them, and constants and types move
beside their code. Decide separately whether users keep the settings.

**8. Tools that replace checks.** Recommended: replace a check with a tool gspot already ships when a run confirms the
tool covers the case. The checks section names the candidates.

**9. The `apply --dry-run` rule diff.** It reads generated files back through five parsers and an ESLint process, about
650 lines. Recommended: compare rule data before it is written instead.

**10. `check` flags.** Recommended: one `--hook <name>` replaces `--hook`, the hidden `--push`, and the stage meaning of
`--staged`, and `--changed` takes a `--base <ref>`.

**11. Vale downloads.** Recommended: only `gspot install` downloads Vale packages, not `apply` or `set`.

### Tests

**12. Suites.** Recommended: merge unit with integration into `tests/cli`, and acceptance with tools into `tests/tools`.

**13. Time limits.** Recommended: one default per suite instead of about 110 limits on single tests.

**14. Test packages.** Recommended: move `testdirs`, `verdaccio`, and the rule tester to `tests/package.json`.

### Repository

**15. Docs hosting.** Where will gspot.dev be served? Until a host exists, the deploy job waits.

**16. Release.** Recommended: create the `release` environment with a required reviewer before the first release, and
use `./` instead of `$/`.

**17. Crons.** Done on October 3: both weekly schedules are gone (`f513db1c`), and `pins.yml` and `database.yml` run
only by hand. No workflow runs on a schedule, and none will.

**18. Test-only tools.** Recommended: move them to `mise.test.toml`.

**19. `GSPOT_CI_ENABLED`.** No workflow reads it. Recommended: delete it.

### From the second pass

**20. `REFUSED_REASONS`.** Every entry is one word, and the two-word minimum already refuses them, so the list decides
nothing. Recommended: delete it.

**21. The `dev` task.** The shipped `TASKS.md` rule asks for a `dev` task where a project has a server, and the first
pass deletes the alias. Recommended: rename `serve:docs` to `dev`.

**22. The package `tsconfig.json` files.** They are the place to give `packages/*/src` the Node.js types and nothing
else. Recommended: keep them for that.

**23. The agent rules layout.** Recommended: apply the layout changes of the agent-rules review. They merge four files,
move a dozen sections, and install the Node.js, next-intl, and Drizzle rules only where they apply.

Each area section ends with its own questions, which hold the details.

## The plan

Run the phases in order. Each phase lands as commits on `main`. Lint and test them before each push. The area sections
hold the file-level steps.

### Phase 1: fix the bugs

The first pass found these.

- `gspot ignore --remove` hides an apply failure behind a success line.
- `init --ci github` and `init --ci gitlab` are ignored when the repository has a lint job.
- `check --changed main` reads `main` as a path, and `check --dry-run` without `--fix` does nothing.
- `apply`, `set`, `ignore`, `add`, `remove`, and `init` download Vale packages, although their help says they install no
  tools.
- `init` writes `gspot.toml` before it resolves the tool locks. A failure leaves the file, hides the package manager
  output, and blocks a second `init`.
- `Root.read` refuses links, but reads user files such as `.gitattributes`, so a symlinked one breaks the repository
  read.
- Doctor says "Run: gspot install" for native tools that install never installs.
- Level `all` adds no compiler flags, `limits.file_kb` has no value at level `recommended`, and setting
  `tools.eslint.restricted_imports` drops the Zustand rule.
- `architecture.contracts` is accepted and never read, and `RUFF_PREVIEW_RULES` contains `null`.
- React Native code gets Node.js globals, and the SwiftFormat configuration enables rules and then disables them.
- In `gspot.toml`, `tools.eslint.node_version` and `architecture.roles.runtime` switch off two checks they mean to keep.
- The comments garbled by the "confined" to "files" replacement in the file-safety code.

The second pass found these. The [file-by-file review](#file-by-file-review) has the lines and the fixes.

Commands:

- `check --push` with the wrong number of arguments exits 2 and prints nothing.
- `gspot explain level` reports that no kit is called `level`, and so does every other top-level setting.
- `ignore --remove` cannot remove an entry that a later `ignore` merged paths into.
- An unknown `--scope` falls back to the root scope. A folder with no `[[scope]]` entry is reported as missing.
- `init --dry-run` and `init --yes` show different kit lists, because a detected `proposed` kit is added only with
  `--yes`.
- Passed checks are hidden with or without `--quiet`.
- `apply` deletes `CLAUDE.md` and moves its text into `AGENTS.md` even when `rules.install` is false.
- After `gspot.toml` or `.gspot/` changes, the planner brings back files that `tools.<tool>.exclude` removed.
- A profile export drops empty tables the author wrote, such as `[hooks]`.

Checks:

- The Bash checks read `#` in `$#`, `${#items[@]}`, and `${name#prefix}` as a comment and cut the line there.
- Bash one-line functions lose their calls, so `unused-functions` reports helpers that are called. Quoted arguments are
  counted one per word.
- Python lambdas and Swift closures count as trivial functions, and Swift reads `private(set)` as `private`.
- Markdown `tsx` fences use the TypeScript grammar, so every JSX fence reports a syntax error.
- `sql/functions` ignores the dialect and the sqlfluff excludes, and errors on any SQL that is not Postgres.
- Postgres compares migration versions as strings, so `10_b.sql` sorts before `9_a.sql`. It also reads dbmate and
  golang-migrate down migrations as forward changes.
- The four Cloudflare checks and seven Postgres checks that run once see only the first scope that selects their kit.
- `cloudflare/types-fresh` looks only for the OpenNext file name, so it skips plain Workers.
- `supabase/storage-policies` crashes on a `config.toml` that does not parse. `supabase/deno` parses JSON before it
  reads the exit code.
- The i18n check passes when the base locale file is missing.
- `xctest/coverage` refuses a Swift package, because it needs an Xcode project.
- The Drizzle table pattern misses tables in a named schema, so the relations check skips them.
- The jscpd error names `.gspot/jscpd.json` instead of `.gspot/config/jscpd.json`.
- `css/module-classes` reports the classes inside `:global(...)` as unused.
- In hook folders only `pre` is exempt from prefix collisions, so `post-merge` beside `post-checkout` gets a finding.

Kits:

- `docs/lychee-external` runs offline, because the shared lychee config sets `offline = true`.
- The gitleaks output pattern misses redacted matches. The template writes `[[allowlists]]`, which gitleaks reads only
  from 8.25, but the kit accepts gitleaks from 8.19.
- `format/editorconfig-checker` reads the Prettier file types instead of the files no formatter touches.
- The naming limits for Swift and SQL never apply, because the shared `naming.max_chars` and `naming.max_words` claim
  both languages first.
- SwiftFormat lets an explicit `--enable` win, so level `recommended` runs the 19 rules it means to turn off.
- `noUselessIndex` rewrites `./lib/index.js` to `./lib`, which Node.js refuses in ES modules.
- Every JavaScript file gets the CommonJS globals, so `no-undef` misses `__dirname` in an ES module.
- `tools.eslint.restricted_imports` does nothing at level `recommended`.
- Two kits pin `eslint-plugin-jsx-a11y` and three pin `eslint-plugin-testing-library`. The pin collector keeps the first
  one and drops the rest without a word.

ESLint plugin:

- The presets register a `gspot` plugin without `configs`, so the README's own block next to a preset fails with "Cannot
  redefine plugin."
- `import-layout` sorts side-effect imports by length, which changes the order in which modules run.
- The plugin needs Node.js 20 for `toSorted` and declares no `engines`. ESLint 9 still runs on Node.js 18.18.
- `import-style` reports `./logo.png` and other assets as missing `.js`.
- `no-cross-scope-imports` names the wrong folder in its message.
- `private-before-public` prints "the exported this declaration" for a default export.
- The index pattern matches `@scope/pkg/index` and misses `#app/index`.
- At level `all`, rules contradict each other in three places. For example, `no-reexports` and
  `unicorn/prefer-export-from` send the user in a circle.

Repository and platform:

- A later `.gitattributes` line cannot unset an earlier one, so `-linguist-generated` has no effect.
- A symlinked `.husky`, `.githooks`, rules folder, or `lefthook.yml` stops `init` and `doctor`.
- The write lock has three races.
- A rejected refspec pattern produces an error with an empty reason.
- On Windows, a pre-push of a new branch fails once the remote has about 800 branches, because every commit goes on one
  command line.
- `scripts/gspot` has no Windows launcher, so the hooks of this repository find no `gspot` on Windows.

### Phase 2: stop shipping one project's choices

Delete the one-project names, helpers, folders, and docs vocabulary from the kits. Move the house-style checks into an
opt-in kit, per decision 3. Strip the agent rules the same way: delete the rules a shipped check already enforces, keep
one copy of each rule, and delete the names of single projects. Source: the [kits section](findings/areas/kits.md), the
[checks section](findings/areas/checks.md), and the agent-rules part of the [file-by-file review](#file-by-file-review).

### Phase 3: install cleanly in every stack

Pin only the tools of checks that run. Write no Prettier files and no npm tool project in projects that need none. Make
`gspot install` install the native tools, or default the runner to mise. Then ship the binary, per decision 1. Source:
the [developer experience section](findings/areas/developer-experience.md).

### Phase 4: restructure the source

1. Delete the `config/` and `types/` mirrors, and move each constant and type beside its code.
2. Group `policy/` into `problems/`, `settings/`, and `schema/`.
3. Apply the layouts of the commands, lifecycle, and generation section and of the execution, tools, repository, platform,
   and parsers section.
4. Give Git one runner with one deadline, file reads one path, and lockfiles one parser.

See the [source diagram](#diagrams).

### Phase 5: shrink the checks

Use one flat registry and one file per kit. Fold the checks that rebuild the tool runner into manifest commands. Merge
the four freshness checks into one. Replace checks with the tools gspot already ships, after a run confirms each one.
Source: the [checks section](findings/areas/checks.md).

### Phase 6: name settings and checks clearly

Give settings one naming rule: `tools.<tool>.*` for tool options and `<kit>.*` for kit options. Use one way to skip
paths (`[[ignore]]` with `paths`) and one way to accept a finding. Rename the vague and wrong check names. Source: the
[kits section](findings/areas/kits.md).

### Phase 7: rebuild the tests

Move to the four suites and one harness of the [tests diagram](#diagrams). Delete the duplicates and the tests that
cannot fail. Move each test to the cheapest suite that runs it, and set one time limit per suite. Move the local
registry from the harness to `scripts/`. Source: the four test sections.

### Phase 8: cut the repository ceremony

Fold the pins check into CI for manifest changes. Keep the Supabase test as a manual workflow. Add no scheduled workflow
anywhere. Fix `docs.yml` and `release.yml`, delete the 31 `--skip-tools` flags, and move the test-only tools to
`mise.test.toml`. Remove the dead lines from `gspot.toml`, and give the grammars one producer. Source: the
[repository section](findings/areas/repository.md).

### Phase 9: rewrite the docs

Rewrite the README install section by project type, and state the real requirements. Build the new docs tree with Python
and Swift quickstarts. Title command pages by command, add check and plugin indexes, and replace the raw schema page.
Write every page in plain language (ISO 24495). Source: the [docs section](findings/areas/docs.md).

## Diagrams

Each image compares today with the target. Red means deleted. Orange means moved or renamed. Green means new, or
gathered from several places. Purple means dissolved into the code that uses it.

### Repository

![The repository root today and after the cleanup](findings/images/repository.png)

### Source

![packages/cli/src today and after the cleanup](findings/images/source.png)

### Tests

![tests/ today and after the cleanup](findings/images/tests.png)

### Docs

![The docs site and READMEs today and after the cleanup](findings/images/docs.png)

### What a Python or Swift project gets

![The files gspot writes in a Python and a Swift project, today and after the cleanup](findings/images/install.png)

## Findings by area

The first pass has one file per area in `findings/areas`. Each lists the file, the problem, and the fix, and ends with
its own questions.

- [Developer Experience in Non-JavaScript and Mixed Projects](findings/areas/developer-experience.md)
- [READMEs, Guides, Reference, and the Docs Site](findings/areas/docs.md)
- [Kits, Settings, and Names](findings/areas/kits.md)
- [Built-in Checks](findings/areas/checks.md)
- [Policy, Kits, Rules, Config, and Types](findings/areas/policy.md)
- [Commands, Lifecycle, Generation, and Output](findings/areas/commands.md)
- [Execution, Tools, Repository, Platform, and Parsers](findings/areas/execution.md)
- [Repository Setup and Ceremony](findings/areas/repository.md)
- [Test Structure: Tiers, Harness, and Samples](findings/areas/test-structure.md)
- [Unit Tests and Check Integration Tests](findings/areas/unit-tests.md)
- [Integration Tests Outside the Checks Folder](findings/areas/integration-tests.md)
- [Native-Tool, Acceptance, and Package Tests](findings/areas/tool-tests.md)

## File-by-file review

The second pass split the repository into 28 slices, and one review read every file of each slice in full. Each slice
lists only what the first pass missed: 1,885 problems in all. After its table, a slice gives its corrections to the
first pass, the files with no new findings, and what it did not read. Short paths are relative to the folder the slice
reviews. Line numbers of `FINDINGS.md` in the corrections refer to commit `f7d8a64c`, before the split.

- [Commands and the Entry Point](findings/slices/commands.md)
- [Checks: General](findings/slices/checks-general.md)
- [Checks: Languages](findings/slices/checks-languages.md)
- [Checks: Database, Framework, Library, Platform, Tool, and the Registry](findings/slices/checks-other.md)
- [The Config Constants](findings/slices/config.md)
- [Types, the Kit Loader, and Rule Assembly](findings/slices/types-kits-rules.md)
- [Execution, Parsers, and Output](findings/slices/execution-parsers-output.md)
- [Generation and Lifecycle](findings/slices/generation-lifecycle.md)
- [Policy](findings/slices/policy.md)
- [Repository and Platform](findings/slices/repository-platform.md)
- [Tool Installation and the Package Build](findings/slices/tools-scripts.md)
- [The ESLint Plugin](findings/slices/eslint-plugin.md)
- [Kits: General](findings/slices/kits-general.md)
- [Kits: JavaScript, TypeScript, CSS, HTML, and Markdown](findings/slices/kits-web-languages.md)
- [Kits: Python, Swift, Bash, and SQL](findings/slices/kits-other-languages.md)
- [Kits: Frameworks, Libraries, Platforms, Tools, and Postgres](findings/slices/kits-frameworks-tools.md)
- [The Agent Rules](findings/slices/agent-rules.md)
- [Docs, Sentence by Sentence](findings/slices/docs.md)
- [Repository Files, Line by Line](findings/slices/repository-root.md)
- [Tests: Unit](findings/slices/tests-unit.md)
- [Tests: Check Integration Tests](findings/slices/tests-integration-checks.md)
- [Tests: Command, Policy, Platform, and Tools Integration Tests](findings/slices/tests-integration-commands.md)
- [Tests: Execution Integration Tests](findings/slices/tests-integration-execution.md)
- [Tests: Generation Integration Tests](findings/slices/tests-integration-generation.md)
- [Tests: Lifecycle and Repository Integration Tests](findings/slices/tests-integration-lifecycle.md)
- [Tests: Native-Tool Tests and Samples](findings/slices/tests-tools-samples.md)
- [Tests: Acceptance](findings/slices/tests-acceptance.md)
- [Tests: Harness, Config, Types, and Package Tests](findings/slices/tests-harness-packages.md)
