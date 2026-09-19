# Frameworks, Naming, and Lint Tools

Row 12 of the build order. Three things change here. The lint tools of gspot install under
`.gspot/` and never into the `package.json` of the developer (D-145). A framework preset carries
its own naming rules and every linter that exists for it (D-112, D-141). The shared rules reach a
component file as they reach a plain one (D-137 to D-140).

## K-217: gspot overwrites the ESLint of the developer

Closes K-217 and K-239.

**What is wrong.** gspot pins ESLint 9 and writes that pin over the version a repository holds.
`mergedPins` in `emit/kept-pins.ts` keeps a held version only when it is an exact version newer
than the pin, and a range is replaced. `npmScripts` writes `prepare = gspot apply`, and `apply`
writes the pins again, so a developer who puts their ESLint back loses it at the next install.
The pins go to the root manifest alone, so a scope that installs by itself lacks the plugins.
Under mise with no root `package.json`, each plugin becomes an `npm:` tool that ESLint cannot
import.

**Target.** gspot never writes a lint tool into a manifest of the developer. The npm tools and
libraries a preset pins install into `.gspot/node_modules`, from a generated `.gspot/package.json`
and its lockfile. Every check runs the binary under `.gspot/`. The ESLint of the developer, its
config, and its plugins stay, and takeover lists them for removal by hand (D-109).

**Files.** New `emit/tool-packages.ts`. Deleted: `emit/kept-pins.ts` and its test. Changed:
`emit/targets.ts` (`runnerOutputs`), `emit/apply-command.ts` (`writePackages`),
`emit/runner-tasks.ts` (`miseSurface`), `platform/tool-probe.ts` (`candidates`,
`libraryVersion`), `lifecycle/install-tools.ts`, `lifecycle/uninstall-command.ts`
(`removePackagePins`), `presets/javascript/knip.json.tmpl`, and `checks/dependencies/manifest-policy.ts`.

**Logic.** `tool-packages.ts` collects every tool with an `npm` name from the selected manifests,
with its pinned version, and writes `.gspot/package.json` with the mark `_gspot`. `install-tools.ts`
runs the install of the package manager the repository uses, with `.gspot/` as its folder,
through `nypm`. The lockfile under `.gspot/` is tracked, and `.gspot/node_modules/` is in the
managed `.gitignore` block. `tool-probe.ts` looks under `.gspot/node_modules/.bin` first and never
under the `node_modules` of the root.

The generated ESLint config sits in `.gspot/`, so its
imports resolve there with no setting. `typescript/tsc` keeps the TypeScript of the repository,
because it answers for the build the developer ships. `manifest-policy` and `doctor` call a lint
package the developer still holds a thing to remove by hand, never a duplicate pin. A mise
install never lists an npm library as an `npm:` tool.

**What goes.** `mergedPins`, the `prepare` script, the scripts and pins of `writePackages`,
`removePackagePins`, and the ignore list of the knip template (K-220). The launcher `gspot` is the
one package gspot writes, under an npm runner (D-147). Every test that links the `node_modules`
of this repository into a planted one installs through `.gspot/` instead (T-32).

**Tests.** A planted repository on ESLint 8 with a plugin of its own holds an unchanged
`package.json` and lockfile after `init --yes`, and `typescript/eslint` runs ESLint 9 from
`.gspot/`. The same case with ESLint 10. A scope with its own install passes its ESLint check.

**Done when.** The three cases pass, and `git diff` after `init` in a planted npm repository
shows one added line in `package.json`.

## K-207: the pinned plugins do not fit the pinned ESLint

Closes K-207 and K-213.

**What is wrong.** gspot pinned ESLint 10, and `eslint-plugin-react`, `eslint-plugin-react-hooks`,
and `@tanstack/eslint-plugin-query` end at 9. The react fragment reads the React version through
a function of its own, `installedReact`, because ESLint 10 took out what the plugin calls.

**Target.** The pin is the newest ESLint that every shipped plugin supports (D-142), which is 9
today. `@eslint/js` and unicorn are pinned at their last version for ESLint 9.

**Files.** The javascript, react, and tanstack-query manifests, `presets/react/eslint.fragment.js.tmpl`,
and the registry test of K-206.

**Logic.** The registry test reads `peerDependencies.eslint` of every pinned plugin and fails a
pin outside one of them. The react setting is `version: 'detect'`.

**What goes.** `installedReact`.

**Tests.** That registry test.

**Done when.** It passes, and it fails when one pin is raised to 10 by hand.

## K-208: the shared rules do not reach a component

Closes K-208, K-209, and K-210.

**What is wrong.** The ESLint template applies every shared block to eight fixed endings, and
`.vue` and `.svelte` are not among them. A component gets no line limit, no complexity ceiling, no
sonarjs, no security rule, and no gspot rule. A framework turns shared rules off by hand in its
fragment, and nothing lists them. `tsc` cannot read a component, Prettier has no Svelte plugin,
Stylelint never sees a `<style>` block, and the naming engine reads no script block.

**Target.** The list of code files holds the endings a framework claims, and one ESLint check
reads it (D-137). A framework turns a shared rule off in its manifest, with a reason (D-138).
Type check, format, style, and names reach a component file (D-140).

**Files.** `presets/javascript/eslint.config.js.tmpl`, the manifests and fragments of react,
nextjs, react-native, nestjs, vue, and svelte, `presets/formatting/manifest.toml`,
`presets/css/manifest.toml`, `naming/extract.ts`, `naming/extractors/typescript.ts`.

**Logic.** `CODE` in the template is built from the `claims.extensions` of the selected presets.
A manifest takes `[[rules_off]]` with `rule` and `reason`, and the template renders that list.

`vue/eslint` and `svelte/eslint` go, because `javascript/eslint` reads their files. The vue preset
runs `vue-tsc` and the svelte preset `svelte-check` through `takes_over` of `typescript/tsc`. The
formatting manifest gains `prettier-plugin-svelte` where svelte is selected. Stylelint gains
`postcss-html` for component files. The naming extractor reads the script block of a component
through the offsets its parser gives.

**What goes.** The fixed list of eight endings, the hand comments in six fragments, and two
copied ESLint checks.

**Tests.** A unit test builds the final ESLint config for `a.ts` and for `A.vue`, and holds that
they differ by exactly the `rules_off` list. A planted Vue file with a long function is a
finding.

**Done when.** Both pass.

## K-211: framework presets are thin beside what exists

Closes K-211 and K-212.

**What is wrong.** react holds eight hand-picked rules. It has no recommended set and no
accessibility plugin. react-native holds four Expo rules, nestjs holds no plugin, and vue and
svelte hold no accessibility rule. No framework holds the testing-library rules. NestJS and
React Native test with Jest, and gspot knows Vitest alone.

**Target.** Every framework preset holds every linter that exists for it, at the same limits
(D-141). A `jest` preset ships with the ten test rules the vitest preset has.

**Files.** The five framework presets, new `presets/jest/`, the rule files `REACT.md`,
`REACT-NATIVE.md`, `NESTJS.md`, `VUE.md`, `SVELTE.md`, and a new `rules/tool/jest/JEST.md`.

**Logic.** D-141 lists the plugins, and the npm registry confirmed each exists and accepts ESLint 9. Each takes its recommended set at `recommended` and its strict set at `all`. `testOverrides`
of the ESLint template takes its rule prefix from the selected test preset. Each rule file grows
to what its linters enforce, one section for each plugin.

**What goes.** The eight hand-picked react rules, where the recommended set holds them.

**Tests.** A planted test file with a focused test fails under jest and under vitest.

**Done when.** That case passes for both, and `rules/lint` passes on the five rule files.

## K-50: framework names in the shared naming policy

Closes K-50, K-133, and K-136.

**What is wrong.** `presets/naming/policy.json` names Next.js for every repository.
`naming/engine.ts` (`REACT_FILE`) lets a `.tsx` file start a function with `handle`, and
everywhere else `handleRequest` is a finding, in an Express server too. Every React component is
a finding, because the policy asks functions for camelCase. The react planted test installs
without naming, so nothing ran the two together.

**Target.** A framework preset carries its naming rules as `[[naming.rules]]` in its manifest
(D-112). The engine knows no framework.

**Files.** `presets/naming/policy.json`, the manifests of react, nextjs, react-native, vue,
svelte, express, and nestjs, `naming/engine.ts`, `naming/validate-name.ts` (`callbackProblem`),
`naming/policy.ts`, `tests/repositories/react.test.ts`.

**Logic.** `policy.ts` merges the rules of the selected manifests after the shared policy. The
react rule accepts PascalCase for a function that returns JSX and for its file. The `handle`
prefix is a rule of react, express, and nestjs. The Next.js route file names move to the nextjs
manifest.

**What goes.** `REACT_FILE`, the branch of `callbackProblem`, and the Next.js entries of the
shared policy.

**Tests.** The react planted test installs with naming and holds no finding for `UserCard.tsx`.
An Express planted handler named `handleLogin` holds none.

**Done when.** Both pass.

## K-49: the prefix rule reads kebab-case alone

**What is wrong.** `prefixOf` in `structure/directories.ts` splits at `-` and `.` only, so
`structure/prefix-collisions` is blind in snake_case and PascalCase code. Files that are no
source count as peers. `packages/eslint-plugin/src/files.ts` holds a second copy.

**Target.** The prefix of a file name is its first word, in any case style (D-111).

**Files.** `structure/directories.ts`, `naming/split.ts`.

**Logic.** `prefixOf` calls `splitName` of `naming/split.ts` and takes the first part. Peers are
files whose nature is `source`.

**What goes.** The copy in the plugin, which leaves with its rule (K-187).

**Tests.** Unit tests for `user_card.py`, `UserCard.swift`, and `user-card.ts` beside a README.

**Done when.** They pass.

## K-137: the extractor skips every awaited value

**What is wrong.** `isImportBinding` in `naming/extractors/typescript.ts` skips a variable whose
value is an `await` expression, because a dynamic import looks like that.
`const userData = await fetchUser()` is never checked.

**Target.** The extractor skips a binding whose value is `await import(...)`, and nothing else.

**Files.** `naming/extractors/typescript.ts`.

**Logic.** `isImportBinding` tests that the awaited node is a call whose function is `import`.

**What goes.** Nothing.

**Tests.** A unit test with both forms.

**Done when.** It passes.

## K-233: the css preset claims files it cannot read

**What is wrong.** The manifest claims `.scss` and `.pcss`, and `stylelint.json.tmpl` extends
`stylelint-config-standard` with no syntax for either. Every variable, nesting, and mixin of a
Sass file is an error.

**Target.** The css preset claims `.css` alone. Detection names Sass as a language gspot has no
preset for.

**Files.** `presets/css/manifest.toml`, the css preset page.

**Logic.** Two endings leave the claim.

**What goes.** The two endings.

**Tests.** The css planted repository holds a `.scss` file with a mixin and no finding.

**Done when.** That case passes.

## K-236: two linters that exist and that no manifest holds

Closes K-236 and K-80.

**What is wrong.** `licenses/npm` reads npm licenses through code of gspot, and Python and Swift
have no license check. `osv-scanner`, which gspot already pins, reads the license of every
package in every lockfile it scans. `supabase db lint` checks the functions of a local database.

**Target.** One check, `licenses/packages`, runs `osv-scanner` with its license flag over every
lockfile of the scope. The supabase preset gains `supabase/db-lint` at the `manual` stage.

**Files.** `presets/licenses/manifest.toml`, `presets/supabase/manifest.toml`. Deleted:
`checks/licenses/npm.ts`.

**Logic.** The allowed list stays `tools.licenses.allowed`, and the scanner takes it as
`--licenses=<list>`. `supabase/db-lint` declares `requires = "database"`, as
`supabase/types-fresh` does.

**What goes.** The hand parser of license expressions, which K-250 had moved to a library, and
the name `licenses/pip` in every document.

**Tests.** A planted uv project with a package under `GPL-3.0-only` fails, and an npm one passes on MIT.

**Done when.** Both pass.

## K-248: the ledger drops rules of the reference repositories

**What is wrong.** [06-enforcement-ledger.md](../06-enforcement-ledger.md) promises that nothing
is dropped. It lands 14 iOS Semgrep rules and the Python rules of yap-text-inference in
`security/semgrep`, and no preset ships either pack. It counts ten landing rules where the
cloudflare pack holds four. Eleven rows name a check nobody built.

**Target.** Every ledger row names a check that exists, or the fix file that builds it.

**Files.** New `presets/swift/semgrep/ios.yml` and `presets/python/semgrep/python.yml`, carried
from the two reference repositories, which are read and not changed.
`architecture/06-enforcement-ledger.md`.

**Logic.** The fix file of row 23 builds the six Python structure rows (K-235). It also builds the
trivial function check for PL/pgSQL and the Swift doc comment rule. `licenses/pip` closes with K-236, and
the second SwiftLint config with K-256. `integrity/generated-fresh` leaves the ledger (K-246). A
pack rule that names a function of one repository goes to that repository (K-218).

**What goes.** Three ledger rows of `generated-fresh`.

**Tests.** A unit test reads every check name of the ledger and fails one that no manifest holds.

**Done when.** That test passes.

## K-249: eight pins older than what a reference repository runs

**What is wrong.** Three pins are a major version behind. stylelint is at 16.23.1 where 17.4.0
runs. linkinator is at 6.1.4 where 7.6.1 runs. purgecss is at 7.0.2 where 8.0.0 runs.

Five more are a minor behind:
`stylelint-config-standard`, html-validate, Trivy, CodeQL, and `@vitest/eslint-plugin`. A
migration moves those repositories back a version.

**Target.** A pin is never below the version a reference repository runs.

**Files.** The manifests of css, html, static-site, docker, security, and vitest, and the ledger,
which records the floor of each tool.

**Logic.** The registry test of K-206 reads the floors from a table in `tests/release/` and fails
a pin below one.

**What goes.** Nothing.

**Tests.** That test.

**Done when.** It passes with the eight pins raised.

## K-256: Swift test files held to production rules

**What is wrong.** The swift and xctest pages promise that `force_unwrapping`, `missing_docs`, and
`no_magic_numbers` are off over test files. `swiftlint.yml.tmpl` has no test section, and no code
reads `tools.swiftlint.extra_configs`. The ESLint config does relax its rules over tests.

**Target.** The xctest preset writes a nested SwiftLint file over the folders it claims, with the
three rules off.

**Files.** New `presets/xctest/swiftlint.tests.yml.tmpl`, `presets/xctest/manifest.toml`.

**Logic.** SwiftLint reads a `.swiftlint.yml` in a subfolder as a nested config. The manifest
writes one pointer file into each claimed test folder, with `parent_config` set to the file under
`.gspot/`, which D-100 allows because the tool has that include form.

**What goes.** The setting name `tools.swiftlint.extra_configs` in two pages.

**Tests.** A planted test file with a force unwrap holds no finding, and a source file holds one.

**Done when.** That case passes.

## K-264: a fresh clone gets no tools and no hooks

Closes K-264, K-265, K-266, and K-283.

**What is wrong.** A teammate who clones a repository that uses gspot has no lint tools and no
hooks, and no document says how to get them. The redo of yap-swift-app cannot install, because
`@gspot/eslint-plugin` and the launcher are on no registry before the first release. The Python
tools have no home without mise. Without mise the plan does not count what a developer installs
by hand.

**Target.** `gspot install` sets up one clone (D-156). It installs the mise tools,
`.gspot/node_modules`, `.gspot/.venv` (D-157), and the hooks, writes no tracked file, and is safe
to run twice. Before the first release it takes its packages from the local registry that
`GSPOT_REGISTRY` names (D-158).

**Files.** New `commands/install.ts`. `lifecycle/install-tools.ts` becomes the function behind
it. New `emit/tool-environment.ts` beside `emit/tool-packages.ts`. `platform/tool-probe.ts`,
`platform/missing-tool.ts`, `lifecycle/init/plan.ts`, `emit/workflow.ts`, `emit/gitlab.ts`,
`tests/harness/registry.ts`.

**Logic.** `tool-environment.ts` writes `.gspot/pyproject.toml` from every tool with a `pypi`
name, and `install` runs `uv sync --project .gspot`. The probe looks under `.gspot/.venv/bin`
after `.gspot/node_modules/.bin`. `init` and `upgrade` call the function, and `--no-install`
skips it. With a yes, `init` adds the line `gspot install` to the setup entry the repository
has (D-115).

`missing-tool.ts` prints `Run: gspot install` for a tool gspot can install, and the
platform hint for a host tool. `check` prints the same line once when the hooks of the config do
not run in this clone. The plan counts the binaries that need mise, and where mise is absent it
shows the one line that installs mise and then all of them.

**What goes.** The two commands that `--no-install` printed, the `mise install` step of both CI
jobs, and the linked `node_modules` of the planted tests (T-32).

**Tests.** A planted clone: `git clone` of an installed repository, then `gspot check` holds the
line, then `gspot install`, then a commit runs the hook. A planted Python repository with no mise
and uv alone runs `python/ruff`. The harness starts the registry and sets `GSPOT_REGISTRY` for
every planted install.

**Done when.** Those cases pass, and the redo of the app installs from the local registry.

## K-267: the install inside `.gspot/` does not see the repository around it

**What is wrong.** npm reads the project `.npmrc` beside the `package.json` it installs, so the
registry, the proxy, and the token of the root are missed. A pnpm workspace whose globs reach
`.gspot/` takes it as a member. Yarn Berry refuses a nested folder that is no part of its
project.

**Target.** The install under `.gspot/` works behind a private registry, inside a workspace, and
under each of the four package managers.

**Files.** `lifecycle/install-tools.ts`.

**Logic.** The function asks the package manager for the registry settings at the root, through
`npm config list --json` and its matches. It passes them to the install as environment values,
so no token is written to a file. It installs with the flag that keeps a project apart:
`--ignore-workspace` for pnpm, and an empty `yarn.lock` with its own `.yarnrc.yml` for Yarn
Berry. The lockfile under `.gspot/` belongs to the package manager the repository uses.

**What goes.** Nothing.

**Tests.** One planted case for each package manager, and one with a registry that needs a
token, served by the harness registry.

**Done when.** The five cases pass.

## K-268: the tools of the developer now read `.gspot/`

**What is wrong.** With D-145 the linters of the developer stay. Their ESLint lints the generated
config, their Prettier reformats it, knip and osv-scanner read its lockfile, and Renovate opens
pull requests against the pins of gspot.

**Target.** The plan tells the developer the one ignore line for each such tool, and gspot never
reports its own folder to them twice.

**Files.** `lifecycle/init/plan.ts`, the takeover rows of the manifests, the dependencies
manifest.

**Logic.** A takeover row takes `ignore_hint`, the line that tool needs, such as `.gspot/` for
`.prettierignore` or `"ignorePaths": [".gspot/**"]` for Renovate. The plan prints the hints of
the tools it found under removal by hand. The checks of gspot skip `.gspot/node_modules` and
`.gspot/.venv`. `dependencies/osv` reports an advisory in a lockfile of gspot apart from the
others, with `gspot upgrade` as its fix.

**What goes.** Nothing.

**Tests.** A planted repository with Renovate and Prettier of its own holds both hints in the
plan.

**Done when.** It passes.

## What each language and framework holds

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
Vue or Svelte component gets the shared rules. Three rule files have no linter behind them: Tailwind, Playwright, and Bun. A preset lists each
where its tool is found ([09-manifests.md](09-manifests.md), K-179).

## What the code does today with the ESLint of a repository

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

D-145 in [14-decisions.md](../14-decisions.md) is the answer, and the owner accepted it on
September 19, 2026. The lint tools of gspot are tools and not dependencies of the repository.
They install under `.gspot/`, and the `package.json` of the developer keeps the ESLint it has.

## K-297: nothing says what a machine without mise, Node, or uv gets

**What is wrong.** The install under `.gspot/` ended at npm, which a Swift or a Python machine
does not have. No document says whether `init` stops on a missing tool, what `gspot install`
exits with, or who installs mise.

**Target.** D-171 and D-172. A missing tool never blocks the setup. `init` writes the config on
any machine, `install` installs what it is able to and lists the rest, and gspot installs no
system software unasked.

**Files.** `lifecycle/install-tools.ts`, `platform/missing-tool.ts`, `platform/install-hints.ts`,
`emit/mise.ts`, `lifecycle/init/plan.ts`.

**Logic.** `install-tools.ts` picks the package manager in the order of D-171: the root, the
first JavaScript project, bun or npm on the machine, then bun from the mise file of gspot.
`emit/mise.ts` pins bun only in that last case, and pins uv where a Python tool is selected. Each
step of the install runs even when an earlier one failed. The command ends with one list of what
is left, each entry with its command, and exits 1 when the list is not empty. `init` exits 0
once the config is written, and prints the same list.

**What goes.** The npm branch at the end of the package manager choice, and any `throw` in
`init` for a tool that is absent.

**Tests.** Three planted machines, each a `PATH` with tools left out. A Swift repository with
mise and no Node installs the npm tools through bun. A Python repository with no mise and no uv
ends `install` with exit 1 and one line for uv. A repository with nothing but gspot finishes
`init` with exit 0.

**Done when.** The three cases pass.
