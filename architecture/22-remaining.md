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

D-145 in [14-decisions.md](14-decisions.md) proposes the answer: the lint tools of gspot are
tools and not dependencies of the repository. They install under `.gspot/`, and the
`package.json` of the developer keeps the ESLint it has. The owner has not accepted it.

## Names, workarounds, and leftovers to clean

Counted in `packages/` on September 19, 2026. Each line names the row that owns it.

- The word `render` stands in 108 places, `synced` in 15, and `corpus` in 34 (K-54, K-146).
- The word `surface` stands in 179 places, `layer` in 71, and `inspection` in 25 (K-66, K-89).
- The source holds 44 type casts and four `eslint-disable` comments. Four integrity tests build
  their input by a cast (T-21).
- The habits of one deploy repository stand in the shell checks: `run_ssh`, `_CFG_<NAME>_READY`
  and a sweep of `nvidia-smi` (K-123). `rules-lint/terms.ts` names `slopshop`.
- The list of lint packages holds `supabase`, `concurrently`, `globals` and `husky`, which are
  no linters (K-237).
- Test files are named around the banned folder words: `handheld`, `components`, `libraries`
  and `pyproject/` (T-31). The source folders `apple/` and `pyproject/` wait for D-128.
- One check id uses the British spelling: `xcode/asset-catalogues` (K-228).
- Seven tests skip themselves (S-7, T-8).
- Three branches of work are parked: the stash `hooks-existing`, the second `vale.ini` under
  `prose/`, and the twelve lint stubs at the root of this repository.

## What is still unchecked

By the order of the owner, nothing below is touched before its step.

- A real install in yap-swift-app, with every written file read, and the time of every check
  there. That is step 9.
- Any other reference repository.
- Windows: the Bash hooks, path separators, and the CI job.

Not done in this read, and owed before the fixes start:

- 96 of the 107 rule files were read by script and not by a person.
- `01` to `12` of this folder were compared with the decisions by a word search, not claim by
  claim.
- The pins of the mise, brew and GitHub installers were not asked from their registries. The
  release test of K-206 does that.
- What a developer sees when a tool crashes, the config is half written, two runs overlap, or
  `apply` is stopped midway. Nobody has tried these.
- The licenses of the bundled dependencies, the grammars and the Vale packages, and a file that
  gives notice of them.
- The build of the docs site.
