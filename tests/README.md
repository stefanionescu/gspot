# Tests

Choose a suite by the behavior it exercises.

| Directory                             | Scope                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/tests/unit/`            | Isolated parsing, selection, rendering, and analysis logic. Small file fixtures supply inputs to individual analyses. |
| `packages/cli/tests/integration/`     | Repository discovery, policy persistence, process execution, and check execution across modules.                      |
| `packages/eslint-plugin/tests/rules/` | ESLint rules exercised through the rule tester and planted input files.                                               |
| `tests/integration/`                  | Shared harness process handling and local registry lifecycle.                                                         |
| `tests/acceptance/cli/`               | Command-line workflows, configuration changes, hooks, and reports.                                                    |
| `tests/acceptance/languages/`         | Language checks run against planted repositories.                                                                     |
| `tests/acceptance/frameworks/`        | Framework and test-tool checks run against planted repositories.                                                      |
| `tests/acceptance/repository/`        | Repository-wide policy and tool checks.                                                                               |
| `tests/release/`                      | Build and publication arguments, compiled resources, and installed packages.                                          |
| `tests/harness/`                      | Shared fixture, command, and registry code. No test cases.                                                            |

Run a focused suite with `bun test <directory-or-file>`. Run the command-line
workflow suite with `bun test tests/acceptance/cli`. The complete source suite is
`bun test`. Language and framework cases require their declared external tools;
consult the tool list in each suite before running it.

Built-package acceptance requires prepared release artifacts and
`GSPOT_RELEASE_TEST=1 bun test tests/release`. Reference-repository acceptance
requires `GSPOT_ACCEPTANCE` with colon-separated repository paths. A skipped
artifact or reference case provides no acceptance evidence.

Assert findings, status, persisted bytes, or another observable result. Do not
add tests for removed commands or fields, count configuration entries, or search
test source for check names as a substitute for executing those checks. Keep
failure cases that exercise real user input, files, processes, and services.
