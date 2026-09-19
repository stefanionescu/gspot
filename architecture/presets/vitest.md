# `vitest`

Kind: tool. Requires: typescript or javascript.

## Detects and claims

|        |                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------- |
| Detect | `vitest` in dependencies                                                                        |
| Claims | test files: `**/*.{test,spec}.{ts,tsx,js}`, `**/tests/**`, `**/__tests__/**`, `vitest.config.*` |

## Tools

@vitest/eslint-plugin, @vitest/coverage-istanbul or v8.

## Generated configuration

The ESLint config gains, over test files: `vitest/no-focused-tests` (not fixable),
`no-disabled-tests`, `no-identical-title`, `no-standalone-expect`, `no-commented-out-tests`,
`expect-expect`, `valid-describe-callback`, `no-conditional-expect`, `valid-expect`,
`prefer-strict-equal`; `@typescript-eslint/no-non-null-assertion` off; jsdoc off; a
`no-restricted-syntax` selector counting `toMatchSnapshot` calls for the baseline.

The three rules the reference repository measured and left off enter with a baseline.

## Checks

| Id                                                                  | Stage  | Command                                                                                                                    |
| ------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `typescript/eslint`                                                 | commit | with the test overrides                                                                                                    |
| `vitest/coverage`                                                   | push   | `vitest run --coverage` with thresholds from `[tools.vitest] coverage` (default 80 lines, branches, functions, statements) |
| `gspot/tests-directory-contents`, `gspot/no-harness-barrel-imports` | commit | test support lives in the declared support directory                                                                       |

## Settings

`tools.vitest.coverage_lines`, `coverage_branches`, `coverage_functions` and
`coverage_statements` (default 80 each), and `tools.vitest.harness_dir` (default `tests/support`).
The command reads them through `{setting:<name>}` parts.

## Rule files

`tool/vitest/VITEST.md`, `general/code/TESTING.md`; `tool/playwright/PLAYWRIGHT.md` when Playwright is a
dependency.
