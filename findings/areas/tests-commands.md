# Unit tests of commands, configurations, and rules

These are the unit tests of the CLI commands (`init`, `install`, `apply`, `check`, `add`, `remove`, `set`, `unset`,
`ignore`, `unignore`, `list`, `explain`, `doctor`, `export`), of the configuration manifests and their selection, of
repository detection and existing tooling, of rule-file selection and the managed block, and of three repository
scripts. Most tests run gspot commands in a sandbox. The target: each test file sits under `tests/unit/cli/` at the
path of the source file it tests, its data sits in `tests/config/<topic>.ts`, the tests of `scripts/` go, tests of
removed flags and questions go with them, and every weak, fake, duplicate, or self-policing test is deleted, not
repaired. No new tests are planned; after the code is cut, the "Untested logic" rule decides each untested behavior.

## Test data

Test constants and sample text go to `tests/config/<topic>.ts`; only a single short literal used by one test file stays
in that file. A `tests/config/` file imports only `tests/config/`, writes its gspot.toml as text, and drops type
annotations (`as const`; the test that reads a value checks its type). The placement rows name each value and its file.
The files these tests use:

| File                             | Holds                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| `tests/config/check.ts`          | `gspot check` refusals, fix messages, verbosity, cancellation |
| `tests/config/configurations.ts` | saved configuration choices that apply keeps                  |
| `tests/config/components.ts`     | component samples (`VUE_COMPONENT`)                           |
| `tests/config/dependencies.ts`   | lockfile-host and release-age rows                            |
| `tests/config/detect.ts`         | detection inputs (Python, Swift, Prisma)                      |
| `tests/config/explain.ts`        | `gspot explain` inputs, reason values                         |
| `tests/config/ignore.ts`         | `gspot ignore` and `gspot unignore` rows                      |
| `tests/config/init.ts`           | init CI preferences, configurations, format files, plan rows  |
| `tests/config/manifests.ts`      | configuration manifest rows                                   |
| `tests/config/npm.ts`            | npm clients and npm answers                                   |
| `tests/config/rules.ts`          | rule file selection rows                                      |
| `tests/config/select.ts`         | covered files and scope selection                             |
| `tests/config/set.ts`            | `gspot set` inputs, loosened settings, words, Taplo options   |
| `tests/config/terminal.ts`       | the check report and the argument errors the terminal prints  |
| `tests/config/tooling.ts`        | existing tooling: hooks, rule folders, lefthook files         |

## Findings

### TCM-002: Bad bytes on the pre-push input crash gspot, and a test locks the crash in

- Where: `packages/cli/src/commands/check/command.ts:25-37`, `tests/config/cli/commands/check/refusals.ts:14-23`, `tests/cli/commands/check/refusals.test.ts:42-59`
- Kind: fix-bug
- Problem: When Git sends bytes that are not UTF-8 to the pre-push hook, `TextDecoder` throws a plain `TypeError`, and
  gspot reports it through the "unexpected failure" path: `gspot stopped: The encoded data was not valid for encoding utf-8`, an engine error text. The rows "bytes that are not UTF-8" and "an incomplete UTF-8 sequence" both expect that
  text, so the test protects the bug.
- Fix: In `readPushInput`, catch the decode error and throw a `GspotError` with the error code that CMD-050 picks for
  bad input from Git and the message "Git sent pre-push input that is not UTF-8 text.". Change the two rows to expect
  that message and merge them into one. Do after CMD-050.
- Size: small

### TCM-003: help.test.ts compares a constant with itself

- Where: `tests/cli/commands/help.test.ts:11-56`
- Kind: delete
- Problem: Test 1 checks that every command has help, that the help text and the docs page contain each example, and
  that examples are unique. Both texts are built from the same `COMMAND_HELP` table, so this cannot fail unless a key
  is missing, and then `commandHelp()` already throws when the program is built. The uniqueness check is
  self-policing. Test 2 checks that `LEVEL_SUMMARY` appears in four places that are all built from `LEVEL_SUMMARY`: a
  fake test. The file also imports the docs package into a CLI unit test. Test 3 (no color) is real but is not about
  help.
- Fix: Delete tests 1 and 2 and `help.test.ts`. The color test moves to `tests/unit/cli/terminal/print.test.ts` and
  sets `NO_COLOR=1` (the `--no-color` option goes, CLX-005). Do after CLX-012, which types `COMMAND_HELP` by command
  name, so the compiler checks what test 1 checked.
- Size: small

### TCM-004: Three assertions check a file that no code writes

- Where: `tests/cli/commands/explain/selection.test.ts:220`, `:263`, `:288`
- Kind: delete
- Problem: The tests check that `.gspot/installed.toml` does not exist after `explain`. No source file, past or present,
  writes that file (`git log -S installed.toml -- packages` finds no commit), so the assertion is always true.
- Fix: Delete the three lines.
- Size: small

### TCM-005: A test sets an environment variable that nothing reads

- Where: `tests/cli/commands/check/arguments.test.ts:113`
- Kind: delete
- Problem: `using _environment = useEnvironment({ GSPOT_HOOK: 'pre-commit' })` sets `GSPOT_HOOK`, which no CLI code
  reads; the test passes `--hook pre-commit` on the command line anyway.
- Fix: Delete line 113 and the `useEnvironment` import.
- Size: small

### TCM-006: A test checks the test setup instead of gspot

- Where: `tests/cli/commands/check/refusals.test.ts:46`, `:55`
- Kind: delete
- Problem: The test saves the descriptor of `process.stdin` and checks it is restored after `runGspot`. That checks the
  test function `runGspot`, which replaces and restores `process.stdin` itself, not gspot.
- Fix: Delete lines 46 and 55.
- Size: small

### TCM-007: Tests police the wording of shipped Markdown rule files

- Where: `tests/cli/agent-rules/assemble.test.ts:113-131`, `:133-182`; `tests/config/cli/agent-rules.ts:1-44`
- Kind: delete
- Problem: Three tests check the text of shipped rule files, not gspot behavior: `CHECKED_RULE_LINES` checks that nine
  sentences are absent from nine rule files, `UPSTREAM_GUIDES` checks that eleven rule files contain a given URL, and
  "renamed library guidance" checks that old file names such as `REACTHOOKFORM` do not appear. Each runs four times
  (2 levels × 2 scopes). The selection code never reads sentence content except level markers.
- Fix: Delete the three tests and `RULE_CONFIGURATIONS`, `CHECKED_RULE_LINES`, and `UPSTREAM_GUIDES` from the data
  file. No separate TALKING.md test is kept: its selection stays tested by the runtime and always-selected tests.
- Size: small

### TCM-008: Manifest tests police gspot's own TOML style and removed keys

- Where: `tests/cli/configurations/errors.test.ts:225-231`, `:248-259`, `:261-277`, `:296-303`, `:305-308`; data `tests/config/cli/configurations/errors.ts:45`
- Kind: delete
- Problem: Five tests check that manifests refuse keys that no longer exist (`imports`, `alternatives_checked`,
  `borrowed_checks`, `scoped`, `component_globs`). The manifest schema is already strict (`strictObject` 16 times), so
  every unknown key fails; naming old keys one by one only guards removed features. The table-order test checks
  `manifestTableErrors`, which forces gspot's own manifests to list TOML tables in one order.
- Fix: Delete the five retired-key tests and `ROOT_SELECTOR_REFUSALS`. The table-order test goes with
  `manifestTableErrors` and `MANIFEST_TABLE_ORDER` (LIF-006).
- Size: small

### TCM-010: Delete scripts/release.test.ts

- Where: `tests/cli/scripts/release.test.ts`, `tests/config/cli/scripts/release.ts`
- Kind: delete
- Problem: Test 2 runs `scripts/release.ts` against the current versions in the two `package.json` files, so it fails
  whenever the ESLint plugin version and the plugin pin differ, or a version is a prerelease: a repository-state check
  inside the unit tests. Test 1 starts four processes for four tags that all fail on the same line. The release
  workflow already runs the script on every tag.
- Fix: Delete both files.
- Size: small

### TCM-012: agents.test.ts guards features that were removed

- Where: `tests/cli/commands/agents.test.ts:18-47`; `gspot.toml:410-413` (the CodeQL ignore that lists this file)
- Kind: delete
- Problem: The first test creates `.cursor/.keep` and `.github/copilot-instructions.md` and checks that
  `.cursor/rules/gspot.mdc` and `CLAUDE.md` are not written and that `GEMINI.md` keeps its bytes and mode. gspot
  stopped writing the Cursor rule, the Copilot file, and `GEMINI.md` in commit `cc7c81700`. The `stat` then `readFile`
  on `GEMINI.md` also triggers CodeQL `js/file-system-race`, which `gspot.toml` ignores for this file.
- Fix: Keep the core of the test: the managed block reaches `AGENTS.md` and the instruction files (written with
  `gspot set rules.instruction_files TEAM.md`), and a second apply leaves `AGENTS.md` unchanged (keep the two `stat`
  calls on `AGENTS.md`). Delete the `.cursor`, Copilot, and `GEMINI.md` parts, including the `chmod` and `stat` of
  `GEMINI.md`. The test moves to `tests/unit/cli/generation/files.test.ts`; the path then leaves the CodeQL ignore
  (TCO-046).
- Size: small

### TCM-013: explain keeps a dead `summary` field, and a test guards that it stays dead

- Where: `packages/cli/src/commands/explain/contracts.ts:203`; `tests/cli/commands/explain/command.test.ts:87-104`
- Kind: delete
- Problem: `explainToolRule` always returns `summary: null`; explain once ran the tool to get a summary (removed in
  `9384fcdf0`). The test spies on `runBlocking` to prove no tool runs, checks `summary: null`, and checks the text has
  no "The tool says:": all three guard the removed feature, and its page and ignore-command lines repeat other explain
  tests.
- Fix: Remove `summary` from the JSON of `explainLintRule` (was `explainToolRule`; `data` is typed
  `Record<string, unknown>`, so no type changes). Delete the test.
- Size: small

### TCM-014: Two more tests guard removed fields and flags

- Where: `tests/cli/commands/manual-choices.test.ts:151-164`; `tests/config/cli/commands/program.ts:3-7`
- Kind: delete
- Problem: "policy application writes no hidden choices and refuses the retired history field" checks that the
  ownership log has no `selections` key and that a file with one is refused; the ownership log schema is strict, so any
  unknown key is refused. The program row "the retired refresh flag" (`--refresh-locks`) repeats "an unknown option":
  Commander refuses every unknown option.
- Fix: Delete the manual-choices test and the program row.
- Size: small

### TCM-015: Configuration tests mirror shipped manifest data

- Where: `tests/cli/configurations/select.test.ts:46-87`, `tests/config/cli/configurations/select.ts:22-40`; `tests/cli/configurations/tools.test.ts:11-25,81-105`; `tests/cli/configurations/owners.test.ts:17-26`, `tests/config/cli/configurations/owners.ts:1-10`
- Kind: delete
- Problem: These tests check data, not code: which configurations sit in `configurations/test/` and `infrastructure/`
  (`CONFIGURATION_CATEGORIES`), that express and fastapi suggest `openapi` (`OPENAPI_FRAMEWORKS`), four shipped "who
  declares which tool" pairs, ShellCheck's `suppression` fields, and seven file names the `files` manifest does not
  claim. Any data change breaks them; no code bug does. The logic under each is tested with made-up manifests.
- Fix: Delete the `CONFIGURATION_CATEGORIES` and `OPENAPI_FRAMEWORKS` tests and data, `tools.test.ts:11-25` and
  `:81-105`, and `owners.test.ts:17-26` with `UNSUPPORTED_CONFIGURATION_FILES`.
- Size: small

### TCM-016: Detection tests repeat one code path once per shipped file name

- Where: `tests/cli/configurations/detect.test.ts:31-59`, `:61-97`, `:215-242`; `tests/cli/configurations/testing-library.test.ts`
- Kind: delete
- Problem: 23 rows list every file name that cloudflare, openapi, supabase, python, and swift detect, copying the
  `[detect]` tables of the manifests. Four TanStack adapters and five Postgres libraries times two scopes repeat one
  dependency lookup. These tables are weak: one code path per reader, many rows of shipped data.
- Fix: Delete the TanStack, file-name, and Postgres dependency tests whole. The Testing Library test stays as the
  dependency case and joins `tests/unit/cli/repository/detect.test.ts`.
- Size: medium

### TCM-017: Five of nine "configurations" test files test repository code

- Where: `tests/cli/configurations/detect.test.ts`, `owners.test.ts`, `takeover.test.ts`, `testing-library.test.ts`, half of `select.test.ts`
- Kind: move
- Problem: These files test `src/repository/selection` (`detectConfigurations`, `detectUnselected`, `isOwned`,
  `ownedBy`, `selectForScope`) and `src/repository/discovery` (`getTooling`, `getLintJobs`). A reader looking for
  detection tests looks in the repository tests. `takeover.test.ts` has no "takeover" in it: it tests discovery of
  existing hooks, CI files, rule folders, and tool files.
- Fix: Move them to the tests of their source files: `tests/unit/cli/repository/detect.test.ts` (detect and Testing
  Library), `tests/unit/cli/repository/select.test.ts` (the coverage tests of `owners.test.ts` and the `selectForScope`
  tests of `select.test.ts`), and `tests/unit/cli/repository/tooling/files.test.ts` and `hooks.test.ts` (was
  `takeover.test.ts`). Their data goes to `tests/config/detect.ts`, `select.ts`, and `tooling.ts`.
- Size: medium

### TCM-018: Two files test "apply keeps saved configurations" with near-identical tests

- Where: `tests/cli/commands/manual-choices.test.ts`, `tests/cli/commands/reconciliation.test.ts`, `tests/config/cli/commands/{manual-choices,reconciliation}.ts`, `tests/types/cli/reconciliation.ts`
- Kind: merge
- Problem: Both files test one rule: apply adds new detections and never removes a configuration already in
  gspot.toml. Several tests run the same path and differ only in how a configuration got into gspot.toml (the root row
  of `INITIAL_OVERRIDES`, "authored language choices remain...", "adding an already detected language...", the detect
  template test, the absent-scope test), and the React DOM test repeats the saved-configurations test.
- Fix: Merge them into the tests of `commands/reconcile.ts`: `tests/unit/cli/commands/reconcile/configurations.test.ts`
  (root and scope choices kept, a manual removal kept, no always-selected or inherited configurations added, a new
  detection saved once) and `reconcile/settings.test.ts` (settings, ignores, and command checks kept; an absent scope
  kept; Expo options kept). Delete the duplicates and the React DOM test, and delete `tests/types/cli/reconciliation.ts`:
  its one type is written inline as `Disposable & { directories: string[] }`, the return type of the helper
  `mockNpmCommands` in `reconcile/settings.test.ts`.
- Size: medium

### TCM-019: commands/ci.test.ts duplicates the init CI tests

- Where: `tests/cli/commands/ci.test.ts`, `tests/cli/commands/init/ci.test.ts`, `tests/config/cli/commands/init/ci.ts`
- Kind: merge
- Problem: Both files test init's CI choice. Rows 2 and 3 of `ci.test.ts` (an existing lint job means init proposes no
  CI job) reach the same decision that `init/questions.test.ts:175-200` checks with the same lint-job files. Row 1 (an
  existing GitHub workflow wins over a GitLab remote) is close to `CI_PREFERENCE_CASES`.
- Fix: Init asks no CI question, and `planCi` becomes `proposeCi` in `commands/init/settings-text.ts`. Add row 1 to
  `CI_PREFERENCE_CASES` (`tests/config/init.ts`) as "a GitHub workflow before a GitLab remote"; the CI proposal tests go
  to `tests/unit/cli/commands/init/settings-text.test.ts`. Delete `tests/cli/commands/ci.test.ts`.
- Size: small

### TCM-020: set/reasons.test.ts repeats other tests

- Where: `tests/cli/commands/set/reasons.test.ts:9-33`, `:35-58`, `:60-89`
- Kind: delete
- Problem: Test 1 (an ignore and a looser limit need a reason) repeats the needs-a-reason part of the set reason tests
  and checks that the output does not contain the word "undefined", a defensive check. Test 2 removes an allowed name
  with `gspot set naming.allowed '{}'`, which works only because `set` on a map deletes every other entry today
  (POL-003); `naming.allowed` itself goes (it merges into `[[naming.override]]` records with `allowed_names`, TML-005).
  Test 3 repeats the list-edit rows of the set reason tests; its one new case (a `links.allowed_urls` edit keeps the
  reason) repeats "$key keeps its reason through list edits".
- Fix: Delete `reasons.test.ts`.
- Size: small

### TCM-021: Delete save-policy.test.ts

- Where: `tests/cli/commands/save-policy.test.ts`
- Kind: delete
- Problem: Test 1 checks that `savePolicy` calls its change function once: an internal detail no user sees. Test 2
  (gspot.toml changed after gspot read it) repeats the settings file test that sends the same concurrent edit to
  `writePolicyFile`, the function `savePolicy` calls, and expects the same message.
- Fix: Delete the file.
- Size: small

### TCM-022: Case explosions run the same branch dozens of times

- Where: `tests/cli/commands/set/command.test.ts:38-65` with `tests/config/cli/commands/set/command.ts:5-55`; `tests/cli/commands/remove.test.ts:109-122`
- Kind: delete
- Problem: The set conflict test runs 8 flag pairs × 2 settings × 3 JSON positions = 48 gspot runs; the flags it sets
  against each other (`--replace`, `--remove`, `--default`) go (CMD-092). The always-selected test runs 7 general
  configurations × 2 commands × 4 flag sets = 56 gspot runs of one `if`.
- Fix: Delete the set conflict test and its table. The always-selected test keeps one configuration with plain and
  `--json` output; its remove half stays in `tests/unit/cli/commands/remove.test.ts`, and its add half becomes "add
  refuses an always-selected configuration before writing" in `add.test.ts`.
- Size: small

### TCM-024: Four platform skips are not needed

- Where: `tests/cli/configurations/takeover.test.ts:197`, `:215`, `:233`; `tests/cli/commands/agents.test.ts:129`
- Kind: delete
- Problem: These tests skip Windows because they create symbolic links, but other tests in the same CI job create
  symbolic links on Windows without a skip and pass (`takeover.test.ts:170`, `export.test.ts:71-72`,
  `init/replace.test.ts:158`, `init/refusals.test.ts:186`, `roots.test.ts:31`).
- Fix: Remove `skipIf(!isPosix)` from the three `takeover.test.ts` tests; the `agents.test.ts:129` test goes whole
  with the `CLAUDE.md` code (gspot never touches `CLAUDE.md`, DOC-011). Keep the skips that are needed: the signal
  tests in `check/cancellation.test.ts:13` (Windows has no POSIX signals) and the Windows execute-bit branch in
  `check/copies.test.ts:27`.
- Size: small

### TCM-027: An ESLint suppression hides a race that comes from reading gspot.toml twice

- Where: `tests/cli/commands/apply.test.ts:22-58` (suppression on line 36); `packages/cli/src/commands/public.ts:261-269`
- Kind: delete
- Problem: The test needs `// eslint-disable-next-line n/no-sync` because it spies on `readFileSync` and writes
  gspot.toml inside the spy, to reach the guard at `commands/public.ts:268-269`. The guard exists because
  `applyCommand` reads gspot.toml twice: once in `openSession` and again in `preparePolicy`.
- Fix: Read gspot.toml once in `applyCommand` (CMD-022), which also removes the window for `--dry-run`. Then delete the
  guard, the spy test, and the suppression. The later write still refuses a changed file through its expected bytes;
  that check in `writeGeneratedFiles` stays and throws a `GspotError` with the `settings` code.
- Size: medium

### TCM-029: Three different messages say "a file changed while gspot ran"

- Where: `packages/cli/src/lifecycle/public.ts:217`, `packages/cli/src/lifecycle/ownership/contracts.ts:264`, `packages/cli/src/platform/root/writes.ts:113`; tests `init/takeover.test.ts:35-37,66-68`, `init/replace.test.ts:140-142`, `tests/cli/policy/file.test.ts:83,144`, `tests/cli/lifecycle/apply/plans.test.ts:23`, `tests/cli/lifecycle/ownership/conflicts/plans.test.ts:31,85,112,197,209`, `tests/cli/execution/fixers/policy-layout.test.ts:72`
- Kind: rewrite-text
- Problem: One situation has three texts: "The gspot.toml file changed while gspot was running. Run the command
  again." (`writeGeneratedFiles`), "<path> changed after gspot read it. Run the command again.", and "Lifecycle
  destination changed during the operation: <path>". Tests pin all of them, and the last one is jargon.
- Fix: Use one message everywhere, from one constant: "<path> changed while gspot was running. Run the command again."
  Update every test that pins the old texts. Do after CMD-022 (apply's own "gspot.toml changed" message goes with its
  guard, TCM-027) and LIF-004 (`stageFile` goes with one of the two "Lifecycle destination" throws and its test row),
  so only the messages that remain change.
- Size: small

### TCM-030: User errors say "lifecycle", and tests pin the jargon

- Where: tests `export.test.ts:62`, `init/refusals.test.ts:18-19` data and `:215`, `apply.test.ts:93`, `roots.ts` data `:18`, `tests/cli/platform/{root,claims,source}.test.ts`, `tests/cli/tools/vale.test.ts`, `tests/cli/tools/inspect/installations.test.ts`; source `packages/cli/src/platform/root/{contracts,reads,writes,public}.ts`, `packages/cli/src/lifecycle/ownership/public.ts`, `packages/cli/src/checks/general/site/contracts.ts:34,88`
- Kind: rewrite-text
- Problem: Users see "Unsafe lifecycle path: "../outside"", "Unsafe lifecycle destination: linked", "Lifecycle
  destination is not a private regular file: linked.toml", "Lifecycle metadata is not a generated target", and the
  writer-lock messages "Incomplete lifecycle claim" and "Another lifecycle writer". "Lifecycle" means nothing to a
  user, and the writer lock is called a "claim" in code and messages.
- Fix: Say what is wrong and what to do, for example "../outside is outside the repository. Choose a folder inside
  it." and "linked is a link. gspot does not write through links."; the state-folder refusal names `.gspot/state` and
  is reached through `rules.instruction_files`. Rename `claim`, `claimPath`, `releaseClaims`, and `CLAIM_*` to `lock`,
  `takeLock`, `releaseLocks`, and `LOCK_*`, so the messages and `writer.lock` use one word. Update the tests to the new
  text. Skip the lines that other findings delete: the three Vale link checks (LIF-017), `readInstalledTree` (LIF-001),
  the unreachable "interrupted mutation" throw (LIF-012), `pauseUntilClaimed` and its "being initialized" message
  (TPR-021), and the "changed while being read" message (PLR-052).
- Size: medium

### TCM-032: Test file and folder names do not say what they test

- Where: `tests/cli/agent-rules/assemble.test.ts`, `instructions.test.ts`; `tests/cli/commands/{program,roots,remove,policy-preview,reconciliation,manual-choices,agents}.test.ts`, `check/copies.test.ts`, `explain/{command,selection}.test.ts`, `ignore/{command,removal}.test.ts`, `init/takeover.test.ts`; `tests/cli/configurations/takeover.test.ts`
- Kind: rename
- Problem: Names use internal words or the wrong subject. "assemble" is not a word the source uses; "instructions"
  tests the managed block; "roots" tests a linked `.gspot` folder and a nested gspot.toml; "remove" also tests add and
  install; "copies" tests `--staged`; "explain/command" tests lint rules and checks, "explain/selection" the other
  subjects; "ignore/command" tests adding ignores; two different files are called "takeover".
- Fix: Each unit test sits at the path of its source file: `tests/unit/cli/rules.test.ts` (assemble and instructions;
  `src/rules.ts`); `commands/session.test.ts` (was roots); `commands/remove.test.ts`, `add.test.ts`, and
  `install.test.ts`; `commands/reconcile/configurations.test.ts` and `settings.test.ts` (TCM-018);
  `generation/files.test.ts` (the managed block test of agents); `commands/check/tree/staged.test.ts` (was copies);
  `commands/explain/check.test.ts` (was explain/command) and `commands/explain/command.test.ts` (was
  explain/selection); `commands/ignore.test.ts` and `commands/unignore.test.ts`; `commands/init/write.test.ts` (was
  init/takeover; its test at `:82`, "recommended initialization keeps authored configurations of inactive strict
  checks", moves to `commands/init/replace/plan.test.ts` first); and `repository/tooling/` (TCM-017).
  `policy-preview.test.ts` is deleted with `--dry-run` on those commands (CLX-004), and `program.test.ts` keeps its
  name. Each data file follows its topic.
- Size: medium

### TCM-033: Tests sit in files about other commands

- Where: `tests/cli/commands/list.test.ts:34-38`; `remove.test.ts:76-107`; `set/exceptions.test.ts:178-214`; `init/questions.test.ts:175-200`; `init/replace.test.ts:130-148`
- Kind: move
- Problem: `list.test.ts` calls doctor's `getSuggestions`. `remove.test.ts` tests `install` failing. The "Git download
  hosts" test in `set/exceptions.test.ts` tests the `dependencies/lockfile-hosts` check. The CI-prompt test in
  `init/questions.test.ts` belongs with the init CI proposal. The "replaced file changes after preview" test in
  `init/replace.test.ts` belongs with the other "changed after the plan" tests.
- Fix: Delete the `getSuggestions` lines from the list test (the doctor tests cover them). Move the install test to
  `tests/unit/cli/commands/install.test.ts`; the lockfile-host tests to
  `tests/unit/cli/checks/general/dependencies/lockfile-hosts.test.ts`; the CI-prompt test to
  `tests/unit/cli/commands/init/settings-text.test.ts`, calling `proposeCi`; and the changed-after-preview test to
  `tests/unit/cli/commands/init/write.test.ts`.
- Size: small

### TCM-041: A detection test has a misleading name and asserts almost nothing

- Where: `tests/cli/configurations/takeover.test.ts:62-68`
- Kind: delete
- Problem: "ast-grep adoption leaves a Qlty configuration unselected" creates a file `.qlty` and checks that no tool
  file is found. Nothing mentions ast-grep, and an empty repository gives the same answer.
- Fix: Delete the test.
- Size: small

### TCM-043: A detection test repeats the dependency-file test

- Where: `tests/cli/configurations/detect.test.ts:129-140`
- Kind: delete
- Problem: "Python project detection uses captured dependencies after the authored manifest changes" breaks the root
  `pyproject.toml` after reading it, then checks detection in scope `api`, whose `pyproject.toml` it never breaks. It
  only shows that detection reads dependencies from the list it is given, which the Python dependency test already
  shows.
- Fix: Delete the test.
- Size: small

### TCM-044: Coverage tests guard against changes the code never makes

- Where: `tests/cli/configurations/owners.test.ts:99`, `:102`, `:113-114`
- Kind: delete
- Problem: The tests check that `ownedBy` returns the same objects and does not change the input array; `ownedBy` only
  calls `filter`.
- Fix: Delete the four lines.
- Size: small

### TCM-045: A test changes the shared manifest cache

- Where: `tests/cli/agent-rules/assemble.test.ts:184-217`
- Kind: simplify
- Problem: The test calls `configurationManifests().set('zod', ...)` on the cache every caller shares and puts it back
  in `finally`. If tests in one process ever run in parallel, other tests see a changed zod manifest.
- Fix: Do not change the cache. `selectRuleFiles` reads the always-selected manifests from the cache itself, so use a
  shipped always-selected configuration: with no selected manifests, `general/engineering/agent/TALKING.md`
  (configuration `engineering`) is selected, and passing the `engineering` manifest as well still gives one copy. Run
  the test once ("an always-selected configuration installs its rule file once").
- Size: small

### TCM-047: A check test asserts something unrelated to its title

- Where: `tests/cli/commands/check/arguments.test.ts:158-179`
- Kind: delete
- Problem: The first run expects exit code 2 and "some check is `missing`". That holds because the sandbox has no tool
  project, so tools that gspot installs are missing on any machine; it has nothing to do with manual checks and breaks
  when the always-selected set changes.
- Fix: Drop the exit-code and `missing` assertions and keep the "manual check runs only when --only names it"
  assertion.
- Size: small

### TCM-048: Data tables repeat one case under different labels

- Where: `tests/cli/configurations/tools.test.ts:27` (two versions, same error); `tests/config/cli/configurations/takeover.ts:1`, `:18`; `tests/cli/configurations/testing-library.test.ts:8`; `tests/cli/commands/explain/selection.test.ts:185-200`; `tests/config/cli/configurations/errors.ts:19`
- Kind: simplify
- Problem: Each table repeats one branch: two versions of an already-declared tool (any second declaration is refused),
  `EIO` and `EACCES` (the same rethrow), three `simple-git-hooks` values (one `Object.hasOwn`), three Testing Library
  packages (one glob), eight top-level setting keys that only echo the key, and three malformed version floors.
- Fix: Keep one row per branch in each table. The eight-key explain test only checks exit code 0 and the echoed key,
  so it is deleted.
- Size: small

### TCM-052: A replace test asserts something unrelated to its name

- Where: `tests/cli/commands/init/replace.test.ts:237`
- Kind: delete
- Problem: "init replaces a nested spelling configuration and deletes the original" also checks that `.gitignore` does
  not exist. That depends on the sandbox having no Git repository, which the init Git plan rows already test.
- Fix: Delete line 237.
- Size: small

### TCM-053: The file-size setting says JavaScript and TypeScript count all lines, but they do not

- Where: `packages/cli/configurations/general/structure/manifest.toml:142` (summary of `limits.file_lines`), `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:41`
- Kind: rewrite-text
- Problem: The summary that `gspot list settings` and the settings reference show says "JavaScript and TypeScript
  count all lines; Python, Bash, SQL, and Swift skip comment-only lines." The generated ESLint rule `max-lines` skips
  blank lines and comments, so users and reviewers read the wrong limit.
- Fix: The summary moves with the setting into its TypeScript declaration (`settings/schema/tables.ts`, POL-001); write
  it there as "File limits are 140 for Bash, 400 for SQL, and 300 otherwise. Blank lines and comment-only lines do not
  count." Check the Swift part against the SwiftLint `file_length` options before saying it for Swift too.
- Size: small

### ST2-003: A "variadic option" test tests Commander

- Where: `tests/cli/commands/check/arguments.test.ts:71-78`; `packages/cli/src/commands/check/command.ts:177`
- Kind: delete
- Problem: The test checks that `--only a --json src/selected.ts` keeps the path as a file argument. `--only` is a
  plain variadic Commander option that Commander ends at the next option; gspot has no code for this.
- Fix: Delete the test. `selectionSandbox` then has one caller and is inlined (ST2-006).
- Size: small

### ST2-005: Test data copies the code under test

- Where: `RUNNER_OPTIONS` (`tests/config/cli/commands/init/questions.ts:24-31`)
- Kind: delete
- Problem: The runner question test compares the prompt's options with a copy of the labels in the CLI's own table
  (`RUNNER_CHOICES`).
- Fix: Delete `RUNNER_OPTIONS`. The question and its test go with the init questions (ST2-008).
- Size: small

### ST2-006: Two test functions have one caller left

- Where: `selectionSandbox` (`check/arguments.test.ts:15-30`), `mockNpmLockfile` (`reconciliation.test.ts:89-111`)
- Kind: simplify
- Problem: After the `-C` test, the variadic test (ST2-003), and the React DOM test (TCM-018) are deleted, each serves
  one test.
- Fix: Inline each into its one test. The npm mock reads `NPM_VERSION` and `NPM_SUCCESS` from `tests/config/npm.ts`.
- Size: small

### ST2-008: Tests of what the CLI redesign deletes

- Where: `tests/cli/commands/init/questions.test.ts`, `tests/config/cli/commands/init/questions.ts`; `tests/cli/commands/policy-preview.test.ts`; the `--dry-run` steps of the set, remove, and export tests; the rows of `program.test.ts` that pass `--json` before the command; the `commit-msg` row of the terminal test; the `--dry-run requires --fix.` row of `FIX_REFUSALS`; the expected counts of the unignore test
- Kind: delete
- Problem: Init asks only "Continue?" (CLX-001); `--dry-run` stays only on `init`, `apply`, and `check --fix`
  (CLX-004); `--json` is an option of each command (CLX-005); `--hook commit-msg` goes (CLX-006); `check --dry-run`
  turns on `--fix` (CLX-007); `unignore` removes every ignore of a check unless `--rule` or `--paths` narrow it
  (CLX-011); `set` needs a value (CLX-013). Tests of the removed questions, flags, and branches test deleted code.
- Fix: Delete the tests, rows, and steps of removed questions and flags, and set the unignore counts to the new
  match rule. "without a terminal, init --dry-run prints the plan" becomes a duplicate of "init without a
  terminal names --yes once" and goes. `planCi` becomes `proposeCi` in `commands/init/settings-text.ts`, so the CI
  proposal tests go to `tests/unit/cli/commands/init/settings-text.test.ts`. `askConfirmation` moves to
  `commands/init/command.ts`, so its two real tests (the terminal's answer, cancel) go to
  `tests/unit/cli/commands/init/command/confirmation.test.ts`; its other two tests repeat the `--yes` runs and the
  no-terminal refusal and go.
- Size: medium

### ST2-009: Tests of the `runner` setting

- Where: the v8r test (`tests/cli/generation/config-consumers.test.ts:177-210`), the mise task glob test (`tests/cli/generation/eslint/runtimes.test.ts:192-204`), the Next.js plugin runner loop (`tests/cli/generation/npm.test.ts:88`), the init settings-text runner test, the linked `.mise` refusal, the runner discovery test (`tests/cli/configurations/takeover.test.ts:275-290`), and `EMPTY_TOOLING`
- Kind: delete
- Problem: INX-003 deletes the `runner` setting, `Tooling.runner`, and `runnerFile`; INX-011 always adds
  `.mise/tasks/**` to the script globs. Tests of these test deleted code.
- Fix: Delete the runner discovery test and its data, the mise task glob test (a constant glob is left), and the
  Next.js runner loop. The v8r test keeps its two schema rows (TGN-036); the init settings-text test and
  `EMPTY_TOOLING` drop their runner fields; the linked `.mise` refusal goes whole (DT1-007). The hooks take the start
  command from the repository; whether that gets a test is decided by the "Untested logic" rule after the code cut.
- Size: small

### ST2-014: Names that would clash or say nothing in shared topic files

- Where: `CONFIGURATIONS`, `FORMAT_CASES` (`tests/config/cli/commands/init/policy-text.ts`), `AUTHORED_SCRIPT_SCOPE` (`tests/config/cli/commands/manual-choices.ts`), `ARGUMENT_REFUSALS` (`tests/config/cli/commands/program.ts`)
- Kind: rename
- Problem: Once data leaves its test for a topic file, a bare `CONFIGURATIONS` says nothing; `FORMAT_CASES` already
  names other data in `tests/config/formatting.ts`; `ARGUMENT_REFUSALS` already names the check path refusals in
  `tests/config/check.ts`; and "authored" is a retired word.
- Fix: `INIT_CONFIGURATIONS` and `FORMAT_FILE_CASES` (`tests/config/init.ts`), `SAVED_SCOPE_CHOICE`
  (`tests/config/configurations.ts`), `ARGUMENT_ERRORS` (`tests/config/terminal.ts`).
- Size: small

### DT1-002: Tests use `gspot set` to write record lists

- Where: `tests/cli/commands/set/command.test.ts:179-203` (`gspot set tools.eslint.overrides <json>`) and its data; `tests/cli/commands/set/declarations.test.ts` (`gspot set generated <json>`); `tests/cli/commands/set/reasons.test.ts:35-58` (`gspot set naming.allowed <json>`)
- Kind: delete
- Problem: Today `gspot set` takes a JSON value for a record list and writes the records. In the target, `gspot set`
  writes single values, list items, and table entries (for example one entry of `tools.eslint.rules`), never a `[[...]]`
  record list: record lists are written by hand, `[[ignore]]` records by `ignore` and `unignore`, and scope
  configurations by `add` and `remove --scope` (TMF rule 6).
- Fix: Delete the `tools.eslint.overrides` test and its two data constants; the settings reader tests still cover record lists, which they read from text written by hand. The `generated` and `naming.allowed` tests go because
  their keys are gone (CFR-005, TML-005; TCM-020). `tools.eslint.restricted_imports` is a list of `{ name, message }`
  values, not a record list, so its set test stays.
- Size: small

### DT1-005: Samples write a reason for values that need none

- Where: `REASON_VALUES` (`tests/config/cli/commands/explain.ts`, values that owe no reason); the reconcile samples (a reason for `architecture.roles.env`); the ESLint structure sample (`tests/cli/generation/eslint/structure.test.ts:129-202`, a reason for `limits.index_exports = 2`, which is stricter than the default 20)
- Kind: simplify
- Problem: gspot refuses the reason form on a value that needs no reason (TMF rule 7), so no stale reason sits next to
  a value. `architecture.roles.environment_readers` takes no reason: it describes the project.
- Fix: Write these values plain in the samples: `REASON_VALUES` keeps the reason form only on values that loosen a
  check, the reconcile samples write `architecture.roles.environment_readers` plain, and the structure sample writes
  `limits.index_exports = 2` plain.
- Size: small

### DT1-006: Two guards lose their test input when `rules.folder` goes

- Where: `tests/cli/commands/apply.test.ts:82-96` (a generated file in `.gspot/state`), `:215-233` (a rename that differs only by letter case); `packages/cli/src/platform/root/contracts.ts:193-205`
- Kind: delete
- Problem: Both tests reach their guard by pointing `agent_rules.folder` at an odd place. TML-003 deletes the key, so
  every rule file has a fixed path.
- Fix: The first test stays in `tests/unit/cli/commands/apply.test.ts` and reaches the refusal through
  `[rules] instruction_files = [".gspot/state/notes/AGENTS.md"]`, a path the user still chooses. Delete the second
  test. A guard that no input can reach any more goes with its code; whether a case-only rename of generated files
  gets a test is decided by the "Untested logic" rule after the code cut.
- Size: small

### DT1-007: A linked `.mise` folder is no longer an output ancestor

- Where: `tests/cli/commands/init/refusals.test.ts:198-222`
- Kind: delete
- Problem: The test links `.mise` outside the repository and expects init to refuse before it writes
  `.mise/conf.d/gspot-tools.toml`. gspot now writes `.gspot/mise.toml` and nothing under `.mise/` (INX-001).
- Fix: Delete the test, and drop `.mise` from the list of output ancestors in the source. The linked `.gspot` case
  stays tested by "a linked .gspot folder stops init and check" (`tests/unit/cli/commands/session.test.ts`).
- Size: small
