# Remaining Work

This document lists everything that is left, in the order it is done, and answers three
questions the owner asked on September 19, 2026. Nothing below is built. Each line points at the
rows of [18-gaps.md](18-gaps.md) that hold the evidence, and a line leaves this document in the
commit that closes it.

## The order

The order is fixed by D-121 and by [13-roadmap.md](13-roadmap.md). This list adds what the last
read found.

1. Delete the branch `chore/gspot` of yap-swift-app on this machine. Push nothing there.
2. Do the delete pass of [13-roadmap.md](13-roadmap.md): the `go`, `rust`, `django` and `ruby` presets, the dead
   flags and keys, `why`, `declare`, nine plugin rules, the nine copy stubs. Add to it the six
   rule files that no preset installs (K-232) and the two off switches of K-228.
3. Make CI run for the first time (K-204). Nothing counts as done before that run is green.
4. Do the first fixes 1 to 7 of that document. Add three wrong answers. A TypeScript check
   reads no file (K-226). Nobody counts most suppressions (K-234). A reason writes a line of
   config (K-238).
5. Take one owner out of what ships: the Semgrep packs, the Swift header rules, and the knip
   template (K-218 to K-220). Do the same for the Express and JavaScript guides (K-231), and
   restore the cut list items (K-229).
6. Do rows 1 to 24 of the Adoption phase. Row 12 also takes the ESLint decision below (K-217)
   and the linters of the table below (K-233, K-236).
7. Apply the renames of [19-names.md](19-names.md), and reach the places K-224 and K-225 list.
8. Rewrite the tests that hold a wrong answer or a removed flag (T-27 to T-35).
9. Redo the install in yap-swift-app and measure it. Ask the owner before any other repository.
10. Write the README, the manual and the site ([21-documentation.md](21-documentation.md)).
11. Before launch, settle the npm name (K-121) and the license text in each package (K-145).
    A release cannot ship with a piece missing (K-164). Then comes the first release of the
    binary and the plugin.

## Does the plan hold every linter for what stays

The presets `go`, `rust`, `django` and `ruby` leave (D-136). The table lists what stays. A cell
names the tool a manifest pins today. `D-141` marks a tool the decision adds and no manifest holds
yet. `nothing` marks a job no tool does.

| Language or framework  | Format                                          | Lint and types                                                                                     | Dead code and copies   | Security                   | Tests                | Open                                                                 |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------- | -------------------- | -------------------------------------------------------------------- |
| TypeScript, JavaScript | Prettier                                        | ESLint with ten plugins, `tsc`, `tsc` over JSDoc                                                   | knip, jscpd            | Semgrep, CodeQL, osv       | vitest, jest (D-141) | `tsc` reads nothing in a project with references (K-226)             |
| React                  | Prettier                                        | react-hooks, eight react rules; recommended sets, jsx-a11y, react-refresh, testing-library (D-141) | knip                   | Semgrep                    | vitest               | every component is a naming finding (K-136)                          |
| Next.js                | Prettier                                        | `@next/eslint-plugin-next`, its own type check and build                                           | knip                   | Semgrep, config check      | vitest               | its security guide is never installed (K-232)                        |
| React Native           | Prettier                                        | four Expo rules; three more plugins and `expo-doctor` (D-141)                                      | knip                   | Semgrep                    | jest (D-141)         | no accessibility plugin runs on the pinned ESLint                    |
| NestJS                 | Prettier                                        | two selectors; `nestjs-typed` (D-141)                                                              | knip                   | Semgrep                    | jest (D-141)         | none                                                                 |
| Vue                    | Prettier                                        | `eslint-plugin-vue`; accessibility plugin and `vue-tsc` (D-140, D-141)                             | knip                   | Semgrep                    | vitest               | shared rules do not reach a component today (K-208)                  |
| Svelte                 | nothing today; `prettier-plugin-svelte` (D-140) | `eslint-plugin-svelte`; `svelte-check` (D-140)                                                     | knip                   | Semgrep                    | vitest               | the same as Vue                                                      |
| Express                | Prettier                                        | Spectral over the OpenAPI document                                                                 | knip                   | Semgrep pack               | vitest               | the pack names functions of one repository (K-218)                   |
| CSS                    | Prettier                                        | stylelint standard, CSS module usage, dead selectors                                               | purgecss               | nothing needed             | nothing needed       | `.scss` and `.pcss` are claimed and no SCSS syntax is loaded (K-233) |
| HTML                   | Prettier                                        | html-validate, inline script check, copy check                                                     | nothing                | the script check           | nothing needed       | none                                                                 |
| Python                 | Ruff format                                     | Ruff, basedpyright, pydoclint, import-linter, validate-pyproject                                   | vulture, deptry, jscpd | Ruff `S`, Semgrep, osv     | pytest with coverage | one docstring style is forced (K-227)                                |
| FastAPI                | Ruff format                                     | Spectral, one blocking call check                                                                  | vulture                | Semgrep pack               | pytest               | none                                                                 |
| Swift                  | SwiftFormat                                     | SwiftLint, the analyzer, the build                                                                 | Periphery, jscpd       | Semgrep, CodeQL            | coverage by target   | no license check of Swift packages (K-80)                            |
| Xcode and XCTest       | nothing needed                                  | plutil, nine project checks, four test checks                                                      | orphan sources         | entitlements, transport    | coverage by target   | the SwiftUI and UIKit guides are never installed (K-232)             |
| SQL and Postgres       | sqlfluff                                        | sqlfluff, squawk, the Postgres parser, seven schema checks                                         | nothing                | row level security, grants | nothing              | nothing reads SQL of another dialect (K-160)                         |
| Supabase               | Prettier                                        | `deno lint`, `deno check`, five project checks                                                     | knip                   | Semgrep pack, key check    | vitest               | `supabase db lint` exists and no check runs it (K-236)               |
| Bash                   | shfmt                                           | ShellCheck, `bash -n`, 22 structure checks                                                         | two structure checks   | one Semgrep pack           | nothing              | none                                                                 |
| Docker, nginx, Ansible | nothing needed                                  | hadolint, Compose, gixy, `nginx -t`, ansible-lint                                                  | nothing                | Trivy                      | nothing              | none                                                                 |
| YAML, TOML, JSON, env  | Prettier, taplo                                 | yamllint, taplo, v8r schemas, dotenv-linter                                                        | nothing                | nothing needed             | nothing              | YAML indent is set twice (K-222)                                     |
| GitHub Actions         | Prettier                                        | actionlint, zizmor; pinact (K-204)                                                                 | nothing                | zizmor                     | nothing              | the GitLab file of D-133 has no linter                               |
| Markdown and prose     | Prettier                                        | markdownlint, Vale, lychee, fences, stale paths                                                    | nothing                | nothing needed             | nothing              | Vale starts once for each file (K-176)                               |
| Every repository       | EditorConfig                                    | typos, commitlint, structure, naming                                                               | jscpd                  | gitleaks, trufflehog, osv  | nothing              | licenses are read for npm alone (K-80, K-236)                        |

The answer is yes for the languages, and not yet for the frameworks. Every language that stays
has a formatter, a linter, a type or syntax check, a dead code check, and a security check. The
five framework presets are thin until D-141 is built, and D-137 to D-140 must land before a
Vue or Svelte component gets the shared rules. Three rule files have no preset and no linter
behind them: Tailwind, Playwright, and Bun. They leave with K-232.

## Do the custom rules apply the same way everywhere

They do not. gspot wrote each idea once for one language and copied it to some of the others.
The table lists each idea and where it runs. `tool` means a pinned tool already does it.

| Idea                             | Bash | Python | Swift | TypeScript and JavaScript | Vue and Svelte | SQL  | CSS and HTML |
| -------------------------------- | ---- | ------ | ----- | ------------------------- | -------------- | ---- | ------------ |
| file length                      | yes  | yes    | tool  | tool                      | no (K-208)     | yes  | no           |
| function length                  | yes  | yes    | tool  | tool                      | no (K-208)     | none | none         |
| a function that only forwards    | yes  | yes    | yes   | plugin rule               | no (K-208)     | none | none         |
| a small function with one caller | yes  | yes    | yes   | deleted by K-102          | no             | none | none         |
| two functions with one body      | yes  | no     | yes   | tool (sonarjs)            | no (K-208)     | none | none         |
| a function nobody calls          | yes  | tool   | tool  | tool                      | tool           | none | tool         |
| arguments a function never reads | yes  | tool   | no    | tool                      | no (K-208)     | none | none         |
| private declarations first       | yes  | yes    | yes   | plugin rule               | no             | none | none         |
| one owner reads the environment  | yes  | no     | yes   | plugin rule               | no             | none | none         |
| import cycles                    | none | yes    | none  | tool                      | no (K-208)     | none | none         |
| names: case and banned terms     | yes  | yes    | yes   | yes                       | no (K-210)     | yes  | no           |
| prose in comments                | yes  | yes    | yes   | yes                       | no             | yes  | no (K-176)   |
| suppressions carry a reason      | some | yes    | some  | yes                       | some           | no   | no (K-234)   |
| counts of code lines, not of all | yes  | yes    | no    | no                        | no             | yes  | no (K-171)   |

Three things follow, and K-235 holds them:

- The limits are one number in every language only after D-137 and D-138. Today a component
  file has no limit at all.
- An idea that stays is written once and reads every language through its syntax tree (K-87).
- An idea that is the taste of one owner moves to the `all` level in every language at once.
  K-102 deletes the small function rule for TypeScript and keeps it for the other three.
- A rule file states a rule that no check holds in that language. `PYTHON.md` says one module
  reads the environment, and no Python check asks for it. `language/naming/CSS.md` and
  `HTML.md` exist, and no extractor reads a class name or an id.

## What happens to a developer on another ESLint version

D-142 pins ESLint 9. What the code does today with the version a repository already holds:

| The repository holds                     | What gspot does today                                                             | What the developer sees                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `"eslint": "^8.57.0"`, a range           | replaces it with the exact pin in `devDependencies`                               | a major upgrade nobody asked for; an `.eslintrc` file and every plugin made for ESLint 8 stop working |
| `"eslint": "^10.1.0"`, a range           | replaces it with the exact pin, which is lower                                    | a downgrade; a plugin that needs ESLint 10 fails, and npm refuses the install on the peer conflict    |
| `"eslint": "8.57.1"`, exact and older    | raises it to the pin                                                              | the same as the first row                                                                             |
| `"eslint": "10.2.0"`, exact and newer    | keeps it                                                                          | gspot installs React plugins that end at ESLint 9 beside it (K-207)                                   |
| a `file:`, `link:` or `workspace:` entry | keeps it                                                                          | nothing                                                                                               |
| the runner `none`                        | writes nothing, and `doctor` compares the version found with a floor of 9.38      | ESLint 8 reads `outdated`, and the check refuses to run                                               |
| its own config and its own plugins       | replaces the config with a stub, and carries the rules set to `off` alone (K-193) | its plugins stay installed and lint nothing; knip then reports them as unused                         |
| two scopes with two ESLint versions      | looks for the binary in the `node_modules/.bin` of the root alone                 | one version runs for both scopes                                                                      |

`emit/kept-pins.ts` decides the first five rows, and its unit test holds them as the right
answer. No decision covers any of them. The runner `mise` changes nothing here: ESLint and
every plugin have no mise installer, so they go into `package.json` under every runner but `none`.

The nine new versions the framework pages name (D-141) were asked from npm too: all exist, and
all accept ESLint 9. `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, and
`eslint-plugin-react-native` stop at ESLint 9, which is what holds D-142 in place.

The registry was asked on September 19, 2026 for the 28 ESLint packages the manifests pin. All
exist except `@gspot/eslint-plugin`, which is not published. Two need ESLint 10 and move down
with D-142: `@eslint/js` 10.0.1 and `eslint-plugin-unicorn` 74.0.0. Four refuse ESLint 8:
`eslint-plugin-regexp`, `eslint-plugin-package-json`, `eslint-plugin-zod`, and
`eslint-plugin-unicorn`. The shipped rule set cannot run on the ESLint 8 of a developer, so
using the version the repository holds is no way out.

D-145 in [14-decisions.md](14-decisions.md) is the answer, and the owner accepted it on
September 19, 2026. The lint tools of gspot are tools and not dependencies of the repository.
They install under `.gspot/`, and the `package.json` of the developer keeps the ESLint it has.

## What the lint tool decision changes

The owner accepted D-145. These are the places that write a lint tool into a file of the
developer today, read in the code on September 19, 2026. Each one changes with the decision:

- [ ] `emit/targets.ts` (`runnerOutputs`) and `emit/apply-command.ts` (`writePackages`): stop
      writing `devDependencies` and the scripts `check`, `check:fix`, `apply`, and `prepare`.
- [ ] `emit/kept-pins.ts` and its test: delete both; no pin is merged into a held version.
- [ ] `emit/runner-surface.ts` (`miseSurface`): an npm tool is never an `npm:` tool of mise.
- [ ] A generated `.gspot/package.json` with its lockfile, and an install step that fills
      `.gspot/node_modules`, which the managed `.gitignore` block lists.
- [ ] `platform/tool-probe.ts` (`candidates`, `libraryVersion`): look under `.gspot/node_modules`
      first, and stop reading the `node_modules` of the root.
- [ ] `lifecycle/uninstall-command.ts` (`removePackagePins`): nothing to remove from `package.json`.
- [ ] `presets/javascript/knip.json.tmpl`: no lint package left to ignore (K-220).
- [ ] `doctor` (pinned twice) and `integrity/manifest-policy`: a lint package the developer
      still holds is listed under remove by hand, never called a duplicate pin.
- [ ] Every test that links the `node_modules` of this repository into a planted one (T-32).

One point the decision leaves open: under an npm runner the hook calls `bunx gspot`, which
resolves the `gspot` launcher from the `devDependencies` of the root. The launcher is gspot
itself and no lint tool. The owner decides whether it stays there.

gspot still writes other files of the developer, and D-145 does not change them. They are the
managed blocks in `.gitignore`, `CLAUDE.md`, and `AGENTS.md`, the lines under `.husky/`, and the
block in `lefthook.yml`. They are also the `extends` key of `tsconfig.json` (K-74), the stubs at
conventional paths (D-100), `.editorconfig`, and the git setting `core.hooksPath` (D-115).

## Names, workarounds, and leftovers to clean

Counted in `packages/` on September 19, 2026. Each line names the row that owns it.

- [ ] The word `render` stands in 108 places, `synced` in 15, and `corpus` in 34 (K-54, K-146).
- [ ] The word `surface` stands in 179 places, `layer` in 71, and `inspection` in 25 (K-66, K-89).
- [ ] The source holds 44 type casts and four `eslint-disable` comments. Four integrity tests build
      their input by a cast (T-21).
- [ ] The habits of one deploy repository stand in the shell checks: `run_ssh`, `_CFG_<NAME>_READY`
      and a sweep of `nvidia-smi` (K-123). `rules-lint/terms.ts` names `slopshop`.
- [ ] The list of lint packages holds `supabase`, `concurrently`, `globals` and `husky`, which are
      no linters (K-237).
- [ ] Test files are named around the banned folder words: `handheld`, `components`, `libraries`
      and `pyproject/` (T-31). The source folders `apple/` and `pyproject/` wait for D-128.
- [ ] One check id uses the British spelling: `xcode/asset-catalogues` (K-228).
- [ ] Seven tests skip themselves (S-7, T-8).
- [ ] Three branches of work are parked: the stash `hooks-existing`, the second `vale.ini` under
      `prose/`, and the twelve lint stubs at the root of this repository.

## Every task

One line for each row of [18-gaps.md](18-gaps.md), under the step of [13-roadmap.md](13-roadmap.md)
that closes it. The row holds the evidence and the files. A line is ticked in the commit that
closes its row, and leaves with it. A script builds this list from the two documents, so a row
with no line here fails the placement check.

### Delete first

- [ ] D-136: Delete the `go`, `rust`, `django`, and `ruby` presets whole, with every path the delete table of [13-roadmap.md](13-roadmap.md) lists, and their six tool pins.
- [ ] D-129 to D-133: Delete `gspot why`, `gspot declare`, `gspot profile check`, six of the seven lists of `gspot allow`, `doctor --offline`, `uninstall --keep-hooks`, `apply --check`, and `--dry-run` on the six edit commands.
- [ ] D-100: Delete the twelve lint stubs at the root of this repository.
- [ ] K-92: Delete the subagents sentence from the managed block.
- [ ] K-97: Delete `init --own` and `--project-templates`.
- [ ] K-99: Delete the five `architecture.*` keys nothing reads, and `[editor] vscode`.
- [ ] K-100: Delete `limits.line_length`, `limits.trivial_ast_nodes` and `tools.trufflehog.verified_only`.
- [ ] K-102: Delete `no-trivial-functions` and its option; `no-call-through` covers every function form (see K-235 for the other languages).
- [ ] K-104: Delete `Session.problems`, `PlanOptions.fix`, and the manifest key `conflicts`.
- [ ] K-111: Delete the `lint:justify` and `lint:allow-...` markers.
- [ ] K-115: Delete the `finding` key of `[[ignore]]`.
- [ ] K-119: Delete the branch for an engine that is not built, and keep the comment openers and `UNPARSED_LIMIT` once.
- [ ] K-129: Delete `docsBase`, `ExistingTool.owned` and `RunRecord.root`.
- [ ] K-146: Remove the word `corpus` from the 34 places in the source.
- [ ] K-180: Delete the manifest keys `executable` and `ubi`, and the three readers of `ubi`.
- [ ] K-187: Delete the plugin rules `no-single-file-folders` and `no-prefix-collisions`; the structure engine owns facts about folders.
- [ ] K-188: Delete the five plugin rules a pinned tool covers, and write the rule of that tool in the template.
- [ ] K-195: Delete the pin of `pyproject-fmt` from the python preset.
- [ ] K-205: The docs build runs `reference-pages.ts` first, the pages are git-ignored, and the `docs/generated` check goes.
- [ ] K-240: Delete the runner value `uv` until a reference repository needs it.
- [ ] S-10: The Vale half of the rules lint goes, and the rule files are read by `prose/vale` like every other text.

### The first fixes, with CI green before anything else

- [ ] K-36: Take `setup.cfg` and `tox.ini` off the sqlfluff path list, and never delete a file more than one tool reads (D-109).
- [ ] K-37: Take the bare name `hooks` out of `HOOK_DIRECTORIES`.
- [ ] K-45: Write no record for a run of the `message` stage (D-105).
- [ ] K-47: Delete the nine `copy = true` stubs and `copyStubContent` (D-100).
- [ ] K-61: Rename `packages/cli/rules-lint` to `packages/cli/rules` and the alias to `#rules/*`.
- [ ] K-103: Print no baseline line in the init plan before a check has run.
- [ ] K-108: Make a missing `[hooks]` table mean gspot does nothing there, as `[ci]` and `[runner]` do (D-130).
- [ ] K-109: Never replace a `package.json` script the developer has, `prepare` included.
- [ ] K-114: Let a `gspot-ignore` comment work for every check an engine runs. The test reads the engine of the check, not its id.
- [ ] K-134: Require `inherit_errexit` only where the header declares Bash 4.4, and list it among the Bash 4 features.
- [ ] K-140: Report `missing` when ast-grep is absent, and batch its file list.
- [ ] K-147: Run `check` with the rest of the config when one line is wrong, and report that line as a finding.
- [ ] K-156: Run `drizzle-kit generate` over a copy in the cache and compare; never write into the tree, never run `git clean`.
- [ ] K-157: Let a check declare the setting it waits for, and report `skipped` with that name when it is unset.
- [ ] K-159: Make `express/openapi-fresh` write back the text it read, and never run `git checkout`.
- [ ] K-172: A route counts as tested when a test file of the same scope imports it.
- [ ] K-178: Report a SQL statement at its own line when a block comment stands above it (K-161).
- [ ] K-181: The loader passes the parsed config on whole, as it does for a check, so no key can be left out again.
- [ ] K-186: The rule skips the entry files the repository names in `tools.knip.entry`, which is the one list of entries gspot already keeps.
- [ ] K-189: The rule reports an import whose target leaves the top-level folder of the importer, which is what its summary says.
- [ ] K-192: A name the repository cannot change is exempt from every name check, in `nameProblems`, once.
- [ ] K-204: Write the real hash of `actions/checkout` into the one constant and the three workflows. Add `pinact run --verify` to the config-files preset.
- [ ] K-206: An installer that numbers differently carries its own version beside its name, and a release test asks each registry for every pin.
- [ ] K-226: The check builds the references (`tsc -b --noEmit`) where the file holds any.
- [ ] K-229: The items are restored from the reference repositories. The lint of the rule files reports a list item that stops with no sentence end.
- [ ] K-234: Let each manifest declare the suppression comment of its tool, and read that list for every comment style. Delete the table in `config/integrity.ts` (K-110).
- [ ] K-238: Refuse a line break in a `reason`, a `description`, a rule id, and a word, once, in the config schema; then no template has to escape.
- [ ] K-241: Settle each of the nine contradictions in the rule file, on the side of the decision or the check. Test the rule ids a rule file names against the templates.
- [ ] K-246: Ship `integrity/generated-drift` in the structure preset. Build `integrity/generated-fresh` with `[[generated]]`, or take its name out of every document.
- [ ] K-250: Make the two SPDX packages and the Markdown parser dependencies that do their job. Use or drop each other library the two documents name.
- [ ] K-251: Drop `--skip-updates` from the dotenv fixer, give v8r its config through `V8R_CONFIG_FILE`, and fail the contract test on a flag the pinned tool lacks.
- [ ] K-252: Report a run whose report cannot be written in one line on stderr, and keep its findings and its exit code.
- [ ] K-253: Make the workflow gspot writes follow `GITHUB-ACTIONS.md`: a pinned runner image, a timeout, and a concurrency group. Name the tasks as D-116 decides.

### Row 1: Takeover deletes nothing it does not own

- [ ] K-41: Read disabled ESLint rules from the rules table of the old config alone (K-193).
- [ ] K-42: Send fixer files through `fileBatches`, and report a fixer that exits nonzero.
- [ ] K-76: Read mise tasks from `.mise/tasks/` files too.
- [ ] K-78: Check the gspot line of the hooks for every value of `hooks.tool`.
- [ ] K-120: Read the format of a repository from every Prettier form, `.editorconfig` and Biome before proposing one.
- [ ] K-126: Read dependencies from `requirements.txt`, Poetry tables and `Pipfile` too.
- [ ] K-128: D-140 adds the two component endings.
- [ ] K-158: Closes with K-42: batch the pages and stylesheets.
- [ ] K-182: A language that has a project file is proposed from that file, as D-108 proposes a scope: `pyproject.toml`, `package.json`, or `Package.swift`.
- [ ] K-193: Carry a rule in both directions: off as an `[[ignore]]`, on as `tools.<tool>.rules`, each with its paths. List every setting that was not carried.
- [ ] K-214: Init says that the folder is no git repository, and a preset whose checks all need git is not proposed there.
- [ ] K-237: The list holds the packages of tools a preset pins, read from the manifests, and nothing else.
- [ ] K-247: Recommend a tool preset only where the repository holds that tool, and write a stub only where D-100 allows one. Read a declared workspace from `package.json` with no lockfile.

### Row 2: Hooks, the setup entry, and command names

- [ ] Decide the stash `hooks-existing`: rebuild it on D-101 and D-114 with the value `existing`, or drop it.
- [ ] K-56: Make init read what a hook calls, and put the gspot line in that task (D-114).
- [ ] K-57: Never set `core.hooksPath` where a tracked file sets it, and say when a clone runs no hooks (D-115).
- [ ] K-58: Propose new bodies for the `lint` and `format` names a repository has, and write `gspot:*` only where none exists (D-116).

### Row 2b: Shared manifests, and the way out of a failing hook

- [ ] K-59: Read lint tables of `pyproject.toml` and lint keys of `package.json`, carry them, and list them under remove by hand (D-117).
- [ ] K-60: End a failing hook run with `git commit --no-verify` and the command that reproduces it.

### Row 3: Slow checks and the cache

- [ ] K-43: Hash `.gspot/` once for a run, key each check on the config files it names, and hash files without base64 (D-102).
- [ ] K-53: Make init open one session, apply once, and run the commit stage alone (D-102).
- [ ] K-71: Closes with K-44.
- [ ] K-125: Read the first bytes of a file, not the whole file, for `head`, the binary sniff, and the banner.
- [ ] K-127: Make `upgrade` run only the checks the new version changes, and print an image finding as one line.
- [ ] K-138: Parse each source file once for both naming checks.
- [ ] K-143: Build Swift incrementally for `swift/build`, and keep the clean build for the analyzer at the `manual` stage (D-122).
- [ ] K-148: One parsed set for a scope and a run, shared the way the shell index is.
- [ ] K-162: Read migration history with one `git ls-tree` and one `git diff`.
- [ ] K-176: Map the borrowed extensions under `[formats]` in `vale.ini`, so every file goes by path in one run for each extension.
- [ ] K-196: D-102 gets its measure. The timed test of the tools table runs each check on the planted repository of its preset, and a check over the ceiling is at `push`.

### Row 5: Root pointers and marks

- [ ] K-72: Add one managed block to `.gitattributes`: `.gspot/** linguist-generated`.
- [ ] K-118: Check in the redo of the app whether `apply` spares the hand-made gitleaks baseline, and make `apply` delete only files it wrote.

### Row 6: One baseline file

- [ ] K-46: Print the findings of the files whose count rose, and one line for the rest (D-104).

### Row 7: The report and the build folder

- [ ] K-44: Drop cache entries older than 30 days, and move the Swift build folder to the cache folder of the platform (D-102).

### Row 8: The config text

- [ ] K-51: Write scope settings as sub-tables, and fix the writer so both forms load (D-106).
- [ ] K-88: Accept `src` as `src/**`, and allow a scope inside a scope.
- [ ] K-89: Rename `PolicyScopeLayer`, and keep `slot`, `surface`, `direction` and `exposes` out of text a person reads.
- [ ] K-116: Accept the `json` output format in a `[[check]]` of the repository.
- [ ] K-215: D-144, with the table in [19-names.md](19-names.md) and a test over the manifests.
- [ ] K-216: D-143, one path for every widening.
- [ ] K-222: The YAML block leaves the EditorConfig template, so one value holds for every tool.
- [ ] K-224: Each changes in the commit of its rename.
- [ ] K-225: Each text changes in the commit of its subject, and the check of S-11 also parses every `gspot` command inside a `summary`, `why` and `fix`.
- [ ] K-228: The two switches go, and the id becomes `xcode/asset-catalogs`.

### Row 9: Scopes

- [ ] K-48: Propose a scope for every folder with a project file, and keep scope files under `.gspot/<scope>/` (D-108).

### Row 11: Levels in the Swift preset

- [ ] K-52: Mark each opt-in SwiftLint rule `recommended` or `all`, and render by level (D-110).
- [ ] K-93: Detect the build command, the output folder, the assets folder and the Swift destination, or ask.
- [ ] K-101: Keep in `recommended` of the plugin the rules that find a defect, and add an `all` config for the rest.
- [ ] K-112: Keep one README contents rule, at the `all` level, that does not clash with the banned heading.
- [ ] K-123: Delete the `run_ssh`, `_CFG_<NAME>_READY`, `nvidia-smi` and `/root/.cache` checks from the bash preset.
- [ ] K-135: Split `structure/shell-interpreter` so strict mode and the `mktemp` trap are checks of their own at `recommended`.
- [ ] K-141: Move the default-owner, underscore, doc-section and ordering rules of shell to the `all` level.
- [ ] K-142: Keep the shell defect checks at `recommended`: discarded failures, unchecked `cd`, recursive remove, broad `pkill`, `mktemp` with no trap, unread arguments, and duplicate or unused functions.
- [ ] K-151: Run `integrity/dependency-ownership` only where the scope holds a Python lockfile (`uv.lock`, `poetry.lock`, `pdm.lock`).
- [ ] K-152: Move the seven Python style checks to the `all` level.
- [ ] K-161: Move `sql/block-comments` to the `all` level, and teach the SQL reader block comments once (K-178).
- [ ] K-167: The postgres preset ships `client_schemas = []`, and the supabase preset sets `["public"]`, which a platform preset may do.
- [ ] K-174: The check belongs to the `all` level.
- [ ] K-175: `recommended` runs the `gspot` style alone, which is what `WRITING.md` tells an agent. The `all` level adds the packages. The off list and the vocabulary move into the prose preset.
- [ ] K-198: Each template renders by level. `recommended` holds the recommended set of each tool and the rules that find a defect, and `all` holds the rest (D-119, D-126).
- [ ] K-200: The preset is `proposed`, as `security` and `licenses` are, and the scope list holds what `tools.commitlint.scopes` names and nothing else.
- [ ] K-201: The base holds the flags that only add errors, and every option that changes emit or resolution stays in the `tsconfig.json` of the repository.
- [ ] K-218: A shipped pack names the API of its framework and nothing else. A rule that names a function of one repository moves into that repository, under `tools.semgrep.rules`, in its migration.
- [ ] K-219: Both lines leave the templates.
- [ ] K-221: With K-198, each template renders by level.
- [ ] K-227: The docstring style is read from the `[tool.pydoclint]` or `[tool.ruff.lint.pydocstyle]` table of the project, and both checks belong to the `all` level. The pytest preset names `pytest-cov` as a tool.
- [ ] K-230: A section of a rule file carries the level of the checks it describes, and the assembler leaves out a section above the level of the repository. `REACT.md` names the file after its component.

### Row 12: Frameworks, naming, and lint tools

- [ ] K-49: Split the prefix with `naming/split.ts`, count source files alone as peers, and delete the copy in the plugin (D-111).
- [ ] K-50: Move framework names out of the shared naming policy into `[[naming.rules]]` of each framework preset (D-112).
- [ ] K-133: Move the `handle` exception out of the naming engine into the react preset (D-112).
- [ ] K-136: Accept PascalCase for component functions and files through `[[naming.rules]]` of each framework preset, and test react with naming on.
- [ ] K-137: Skip only a dynamic `import()` in the TypeScript extractor, not every awaited value.
- [ ] K-207: D-142. The pin is the newest ESLint every shipped plugin supports, and the registry test of K-206 reads each range.
- [ ] K-208: D-137. The list of code files holds the endings a framework claims, and one ESLint check reads it.
- [ ] K-209: D-138. The list stands in the manifest with its reasons, and a test compares the final config of a component file with that of a plain `ts` file.
- [ ] K-210: D-140, through `takes_over`, `claims`, and the plugins of each tool.
- [ ] K-211: D-141, and each rule file grows to what its linters enforce.
- [ ] K-212: The `jest` preset of D-141, with the same ten rules.
- [ ] K-213: On ESLint 9 (D-142) the setting is `detect`, and `installedReact` goes.
- [ ] K-217: D-145.
- [ ] K-233: The preset claims `.css` alone, and a `scss` preset that pins `stylelint-config-standard-scss` arrives when the owner or a reference repository asks for it (D-136).
- [ ] K-236: `licenses/npm` becomes one check that runs the scanner gspot already pins, and the supabase preset gains the lint at the `manual` stage.
- [ ] K-239: Closes with D-145: stop writing `prepare` and the pins into `package.json`.
- [ ] K-248: Carry the iOS and the Python Semgrep packs first. Build each other ledger row that names an unbuilt check, or mark it cut with its reason.
- [ ] K-249: Raise the eight pins that sit below what a reference repository runs, and fail the release test on a pin below the floor the ledger records.

### Row 13: The core names no preset and no tool

- [ ] G-13: Keep the constants of the plugin in one `config/` folder, as the CLI does.
- [ ] K-13: Delete `gspot allow gitleaks`, `osv` and `licenses` with the trim of D-131.
- [ ] K-14: Move every owner row and check row of takeover into the manifest of its preset (K-39).
- [ ] K-17: Take the preset ids `swift`, `prose`, `typescript` and `commits` out of the core; a manifest key says what the core asked the id for.
- [ ] K-24: Rename `bashText`, `bashList` and `bashSetting` of the structure context after what they read, for every language.
- [ ] K-38: Move each tool name, baseline file name, flag, banner and check id the core holds into the manifest of its preset.
- [ ] K-39: Replace `OWNER_PRESET`, `CHECK_BY_TOOL` and the nine tool tables of `propose.ts` with keys the manifests hold.
- [ ] K-40: Propose the types folder and the commit scopes from what the repository holds; write no `api/types`, `root`, `hooks` or `deps` by default.
- [ ] K-55: Keep the default hooks folder name in one constant.
- [ ] K-77: Keep the path of the mise file and of `.gspot/hooks` in one constant each.
- [ ] K-79: Register each analysis from the manifest of its preset, name it after its check id, and split `integrity/` by what it holds.
- [ ] K-80: Closes with K-236.
- [ ] K-85: Move the four version flags into `version_command` of their manifests, and hint the install of the runner the repository uses.
- [ ] K-94: Closes with K-169.
- [ ] K-98: Read the global flags in one function that every command calls.
- [ ] K-105: Infer the config types from the zod schema, and keep each list of hook tools, runners, and CI providers once.
- [ ] K-106: Move test-only types out of the types of the binary, and delete the two stale doc comments.
- [ ] K-107: Replace the hand-written fields of `CarriedLists` with a map keyed by tool, filled from the manifests (K-39).
- [ ] K-110: Keep one list of suppression forms (K-234).
- [ ] K-113: Give a manifest a key for the page of a rule, and delete `TOOL_RULE_SOURCES`.
- [ ] K-124: Keep one `HOOK_DIRECTORIES` list.
- [ ] K-131: Keep `JSON_INDENT` and the mise file path once each.
- [ ] K-139: Share one `add` function and one label table across the extractors, and pick a grammar from a table.
- [ ] K-165: Keep the five release targets in one list, and stop embedding the `schema/` folder nobody reads.
- [ ] K-169: It moves to `profile/schema.ts`.
- [ ] K-171: Every check gspot owns counts code lines through `structure/code-lines.ts`, the summary says which languages a tool counts, and the pair of constants goes.
- [ ] K-177: The message comes from the install hint.
- [ ] K-179: A general file that a preset lists installs with that preset, and the general files no preset lists install always. The core names no folder.
- [ ] K-183: The zod schema is the one owner, and the types are inferred from it.
- [ ] K-190: One helper in `files.ts` takes the check and returns the listeners.
- [ ] K-197: A fragment exports its selectors, and the template joins the selectors of every selected fragment into the one rule. The javascript template then names no library (D-139).
- [ ] K-199: No template holds a default.
- [ ] K-203: The word list comes from the manifests.
- [ ] K-220: The entry list holds the entries the detected framework has, and what this repository needs stands in its own `tools.knip.entry`.
- [ ] K-223: D-139 covers them, and its test reads every template for a call of `has(`.
- [ ] K-231: With K-203, a language or framework file says what holds for every project of that kind. The rest moves into the repository it came from, during its migration.
- [ ] K-232: The nextjs preset lists its second file. The swift preset lists the two framework files where the project imports that framework. A file with no preset to carry it is deleted (D-134) until a preset asks for it.
- [ ] K-242: Move the working habits of the owner out of the general rule files into a profile, and add `quality/` to the words the rules lint refuses.

### Row 14: Tests

- [ ] G-2: Give every check a planted defect and every engine folder a unit test, and delete the empty test folders.
- [ ] K-28: Test the ESLint template by resolving the config for one file of each file class and comparing rule lists.
- [ ] T-1: Add a planted install with the mise runner.
- [ ] T-2: Add a planted default `init` that runs in every test run, and drop `--without` where a preset is tested.
- [ ] T-3: Plant two scopes of different languages, a nested scope, and a scope outside a workspace.
- [ ] T-4: Use `install()` in the seven tests that run `init` through `run()`.
- [ ] T-5: Closes with T-29.
- [ ] T-6: Plant snake_case and PascalCase siblings for the prefix rule.
- [ ] T-7: Plant `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, and hooks that must keep running.
- [ ] T-8: Fail with a message about the machine when `toolsPath` cannot find a tool.
- [ ] T-9: Keep the init command line, the `package.json` literal and the tool lists in `tests/config/`.
- [ ] T-10: Closes with T-23.
- [ ] T-11: Rename `repository-check.test.ts` and `scope-languages.test.ts` (T-31).
- [ ] T-12: Add a timed test with a ceiling over a planted repository of 5,000 files.
- [ ] T-13: Plant a hook that calls a task, a setup task that sets the hooks path, a fresh clone, a `[tool.ruff]` table, and a `lint` script.
- [ ] T-14: Make the guard test pass only for a check id inside a planted case that expects exit 1.
- [ ] T-15: Add cases to `require-server-only` and `tests-directory-contents`.
- [ ] T-16: Add edge cases to the 18 unit test files that hold one input each.
- [ ] T-17: Closes with T-28.
- [ ] T-18: Expect a status or a finding, not the check id, in the two expectations.
- [ ] T-19: One test for each language runs the shipped policy over a short file written the way that language and its frameworks are written, and expects no finding.
- [ ] T-20: Change the four tests that expect a defect, each in the commit that fixes its defect.
- [ ] T-21: The harness owns one builder of a whole `EngineInput`, and the four tests use it.
- [ ] T-22: The test reads the commands from the program, and looks for each in both scripts.
- [ ] T-23: Give each analysis that reads text a unit test on a text, with no tool, and no repository.
- [ ] T-24: The planted installs of D-113 cover each value of `--runner`, `--hooks`, and `--ci` once, and one of them starts from a repository that has hooks and mise tasks.
- [ ] T-25: Read the version from the one version source in the two release tests.
- [ ] T-26: Each expects the rule or the sentence of its finding, as the other cases do.
- [ ] T-27: `install()` expects exit 0 when every tool of the install is on the `PATH` it was given, and `plant()` fails when its pattern is absent.
- [ ] T-28: One planted defect for each, and the ones that need the network or Docker run in the `manual` job of CI.
- [ ] T-29: Each expects the rule id or the sentence of its finding.
- [ ] T-30: One case for each preset, which expects the message of its own selector and exit 1.
- [ ] T-31: With D-128 each test file carries the id of the preset it tests.
- [ ] T-32: In the release test of K-206, install the pins of every npm preset into an empty folder with each package manager, and run one check there.
- [ ] T-33: One planted repository for each generator, committed as its generator wrote it, with the number of findings at `recommended` held as the expected value.
- [ ] T-34: The fixture is a project Xcode generated.
- [ ] T-35: Each of these changes in the commit that changes its subject (D-104, D-129 to D-133, D-144).

### Row 15: The redo of the app

- [ ] K-90: Check the reference image layout against the real test files in the redo of the app.
- [ ] K-144: Compare Swift files by path in `xcode/orphan-sources`, move `xcode/test-plan` to `all`, and give reference images a layout setting.
- [ ] K-149: Hand a check the files of its scope in the engine input, and let only a `runs = "once"` check reach the whole repository.
- [ ] K-150: Find Swift tests by their imports and attributes, and read the reason of a skipped test as text.
- [ ] K-153: Name modules from the package roots the project declares (`[tool.setuptools]`, `[tool.hatch]`, a `src/` folder, the scope), and plant a cycle under `src/` in the test.
- [ ] K-154: Build the site into a folder of the cache, with the command of the package manager the repository uses, parsed the way a shell parses it.
- [ ] K-155: Closes with K-149; move the svgo byte check to `all`.
- [ ] K-160: The check runs only where the dialect is `postgres`, and init proposes the dialect from what it finds (a `supabase/` folder, `pg` in the dependencies, a `mysql2` dependency).
- [ ] K-163: Find `supabase/config.toml` inside the scope the check runs in.
- [ ] K-184: The check accepts the places Docker reads, which are the folder of the Dockerfile, the file named after it, and the root of the scope.
- [ ] K-191: A default names no folder. The template passes what the config of the repository says, and a rule with nothing passed reports nothing.

### Row 16: The menu, the levels, and the init questions

- [ ] K-62: Build `gspot list` (D-118).
- [ ] K-63: Give every check and every opt-in rule a `level`, and delete `[inspection] strict` as the switch (D-119).
- [ ] K-64: Ask the preset question in three groups (D-120).

### Row 17: The agent block

- [ ] K-65: Write the managed block as a plain list of the selected presets (A-25).

### Row 18: Plain words and renames

- [ ] K-54: Rename `render` to `emit` and `synced` to `applied` in all 123 places.
- [ ] K-66: Replace the made-up words a person reads with the words of 19-names.md.
- [ ] K-67: Delete the `layer:` key from every rule file; the folder says it.

### Row 19: Cache keys and the push

- [ ] K-69: Cache a `[[check]]` only on the inputs it names, or never.
- [ ] K-70: Make the pre-push hook check the commits being pushed, not the working tree.

### Row 20: The top level of this repository

- [ ] K-68: Keep one `gspot.schema.json` at the root, and let the site copy it at build.
- [ ] K-73: Move `prose/` into its preset, and add `examples/`, `CONTRIBUTING.md`, `CHANGELOG.md` and `SECURITY.md`.

### Row 21: What runs where, and what it prints

- [ ] K-81: Print a line as each check ends, leave passed checks out of the end list, and give counts and times in the summary (D-124).
- [ ] K-82: Ask git whether the hooks run in this clone.
- [ ] K-83: Count as unchecked only files that a linter reads, and use the same count in `check` and `doctor` (S-6).
- [ ] K-84: Reword the `direction` column and the `not a slot` section, and print `unchanged` for a cached pass.
- [ ] K-117: Print the findings in the CI log, and write the JSON report beside them.
- [ ] K-122: Word the init questions in plain terms (19-names.md).
- [ ] K-130: Read the rule lists of every tool template in the upgrade report, not only lines shaped like ESLint.
- [ ] K-132: Say so when the preset question takes its default list without a terminal.
- [ ] K-185: Explain looks in every scope, and prints the value of each scope that holds the key.
- [ ] K-194: Findings of the `security`, `dependencies`, and `secrets` inspections are still held, so adoption is not blocked, and every full `gspot check` prints one line for each of them.
- [ ] K-243: Report a config that does not load with its file, its line, and a plain sentence. Print the hooks line of the uninstall plan only when the path will be unset.

### Row 22: The recommended level

- [ ] K-74: Put no `extends` into the `tsconfig.json` of the developer at `recommended`, and require no compiler option there (D-126).
- [ ] K-75: Move exact versions, `packageManager`, the release age, README rules, banned headings and the Contents rule to the `all` level.
- [ ] K-91: Move the shell header rules, `types-placement` and `no-single-file-folders` to the `all` level.

### Row 23: One copy of each rule

- [ ] K-86: Allow `swift` and `python` as folder names here by `structure.folder_name_allowed`, and move the list out of the shell file (D-128, D-135).
- [ ] K-87: Write trivial-function, call-through and duplicate-function once over the syntax tree, with one set of limits.
- [ ] K-235: With K-87, an idea that stays is written once over the syntax tree and listed in the manifest of each language. An idea of taste moves to `all` in every language in one commit.

### Row 23b: The command surface and GitLab

- [ ] K-95: Build the command surface of 02-cli.md: delete the unused flags, and keep one name for one idea (D-129 to D-133).
- [ ] K-96: Add `--ci gitlab`, and look for `.gitlab-ci.yml` beside `.github` (D-133).

### Row 24: gspot checks itself

- [ ] K-166: Make `doctor` and `gspot list` report which looks each file ending gets, and name an ending that gets only the general ones.
- [ ] S-1: Add one check that writes every template of every preset into the cache and runs the parser and formatter of each kind over it.
- [ ] S-2: Closes with S-1.
- [ ] S-3: Run `bun test` with a coverage floor as a `[[check]]` of this repository at the push stage.
- [ ] S-4: Delete the three folder exemptions of stale-paths, and name the other repositories this folder writes about in one setting.
- [ ] S-5: Run the build of the manual as a `[[check]]` at the manual stage, and delete the link exemption.
- [ ] S-6: Closes with K-83.
- [ ] S-7: Make the documents test fetch what it needs or fail; no test skips itself because something is absent.
- [ ] S-8: Turn the test rules on through `eslint-plugin-jest` for every test runner the template knows.
- [ ] S-9: Turn `[inspection] strict` on in this repository until D-119 replaces it.
- [ ] S-11: Load every `toml` block of the manual through the config reader, and parse every `gspot` line of a `bash` block with the program.
- [ ] S-12: The work of a change ends when its run on GitHub is green, and the steps in [12-repository-layout.md](12-repository-layout.md) say so.
- [ ] S-13: Change each document in the commit that builds its decision, and write `17-migration.md` again from the redo of the app.
- [ ] S-14: Write the preset pages, the ledger ids, the file tree, and the manifest key table by script. Fail the check of S-4 on a name the code lacks.
- [ ] S-15: Write `01-product.md` again after the Adoption phase, from what the product does, with the test that holds each promise.
- [ ] S-16: Correct the false sentences of `02`, `03`, `11`, and `19` with S-13, fix the empty list in the unexposed-setting message, and load every example config through the reader (S-11).
- [ ] S-17: Change each false sentence of `04` to `12` in the commit that builds or drops what it says.

### The README, the manual, and the site

- [ ] G-10: Write the README, the guides, and the landing page that 21-documentation.md lists, from real output.
- [ ] K-202: The guides are rewritten after the redo of the app, from real output ([21-documentation.md](21-documentation.md)), and S-11 keeps them true.

### Before launch

- [ ] K-121: Confirm this project owns the npm name `gspot` before any command asks the registry about it.
- [ ] K-145: Ship `LICENSE.md` in the `files` of the launcher, the plugin, and each platform package.
- [ ] K-164: Both scripts stop at the first missing file, and the publish step verifies every package before it publishes the first.
- [ ] K-244: Name Homebrew in an install hint only for a tool with no pin, give a `github` installer its tag form, and ask all four registries in the release test.
- [ ] K-245: Write one notice file at build from the license of every bundled dependency and grammar, and embed it. Give the Swift grammar a build script that names its source commit.

## What is still unchecked

By the order of the owner, nothing below is touched before its step.

- A real install in yap-swift-app, with every written file read, and the time of every check
  there. That is step 9.
- Any other reference repository.
- Windows: the Bash hooks, path separators, and the CI job.

Not done in this read, and owed before the fixes start:

- 19 rule files of the framework, library, and tool layers, which the owner chose to have read:
  `nextjs/SECURITY.md`, two fastapi files, `SWIFTUI.md`, `UIKIT.md`, seven library guides,
  `SUPABASE.md`, `POSTGRES.md`, `I18N.md`, `DOCKER.md`, and three more. 33 other rule files stay
  unread by the owner's choice.
- 42 of the 48 preset pages, by eye. The six framework pages and `jest` are read.
- `16-file-tree.md` by eye (S-14 holds what a script found).
- The flags each manifest passes, against the help text of the pinned version.

Checked on September 19, 2026, with the row that holds what was found:

- The `why` text of the 205 checks: sound.
- Every pin on npm, PyPI, crates.io, GitHub, and Homebrew (K-206, K-207, K-244).
- A tool that crashes, a config cut in half, two runs at once, and `apply` killed midway (K-243).
- The licenses of the 34 bundled dependencies and the nine grammars (K-245).
- The build of the docs site: 301 pages, every internal link valid.
- Every check id, flag, config key, manifest key, and path the documents name (S-14, K-246).
