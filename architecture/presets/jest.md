# `jest`

Kind: tool. Requires: typescript or javascript.

NestJS and React Native test with Jest by default, so this preset ships beside `vitest` (D-141).
A repository selects the one its tests run with.

## Detects and claims

|        |                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------- |
| Detect | `jest` in dependencies, or a `jest.config.*` file                                                 |
| Claims | test files: `**/*.{test,spec}.{ts,tsx,js,jsx}`, `**/tests/**`, `**/__tests__/**`, `jest.config.*` |

## Tools

eslint-plugin-jest 29.16.6, as a library. The repository owns Jest and its version, as it owns
Vitest under the vitest preset.

## Generated configuration

The ESLint config gains, over test files, the same ten rules the vitest preset holds, under the
`jest` prefix: `no-focused-tests`, `no-disabled-tests`, `no-identical-title`,
`no-standalone-expect`, `no-commented-out-tests`, `expect-expect`, `valid-describe-callback`,
`no-conditional-expect`, `valid-expect`, and `prefer-strict-equal`. The relaxations for test files
are the ones the javascript template holds for every runner, and no other.

The plugin reads another runner through its `globalPackage` setting. This repository sets it to
`bun:test`, which turns the same ten rules on for its own tests (S-8).

## Checks

| Id                  | Stage  | Command                                                                                                            |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `typescript/eslint` | commit | with the test overrides                                                                                            |
| `jest/coverage`     | push   | `jest --coverage` with thresholds from `[tools.jest]` (default 80 lines, branches, functions, and statements each) |

## Settings

`tools.jest.coverage_lines`, `coverage_branches`, `coverage_functions`, and `coverage_statements`
(default 80 each), and `tools.jest.harness_directory` (default `tests/support`).

## Rule files

`general/code/TESTING.md`.
