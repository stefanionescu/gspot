---
title: Tests and coverage
description: Run your test suite with coverage limits, and check Swift tests.
---

gspot runs your test suite as a check at the push stage and fails it when coverage falls below
the coverage limits you set. Keep the test runner and its dependencies in your own project.

Jest, Vitest, and pytest require default minimums of 0% at `recommended` and 80% at `all`. Swift uses `coverage.lines` and `[[coverage.target]]` records. A limit you set applies at both
levels. For a test runner without a configuration, write a [command check](/guides/command-checks/).

## Coverage with `jest`

Run `gspot add jest`, then run the coverage check:

```bash
gspot check --only jest/coverage
```

The check runs Jest in a copy of your sources, so your working tree and reports stay unchanged. Failed tests and missed coverage limits exit with `1`. A suite that cannot load, or a missing
report, exits with `2`.

To require full function coverage:

```bash
gspot set coverage.functions 100
```

Add `--scope app` to set it for the scope `app` only. The
[settings reference](/reference/gspot-toml/) lists every coverage setting.

The Jest configuration reports `.only` tests, skipped tests, and broken test calls, at both levels.
It reads test functions from `@jest/globals` and runs Jest for coverage.

## Vitest

Run `gspot add vitest`, with Vitest and its coverage provider installed in your project. Then
run:

```bash
gspot check --only vitest/coverage
```

Set the minimums under `coverage`: `lines`, `branches`, `functions`, and
`statements`. Vitest finds its own `vitest.config.ts` as usual.

## Python

Run `gspot add pytest`, and install pytest and pytest-cov in your project's `.venv`. Then run:

```bash
gspot check --only pytest/coverage
```

`coverage.lines` sets the line coverage limit. The check runs pytest with strict markers
and strict configuration. The Ruff rules for pytest apply to your test files, and your
app code keeps its own rules.

## Swift tests

Run `gspot add swift-tests`. gspot writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder
that turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, while your
source files keep those rules. `gspot check --only swift/swiftlint` reads these nested files. When configuring an editor directly, omit `--config` from SwiftLint because that option disables nested configuration.

[swift-tests](/reference/configurations/swift-tests/) declares checks for test reasons and coverage.

To set a line coverage limit for a Swift target:

```toml
[[coverage.target]]
name = "Orders"
lines = 80
```

Replace `Orders` with the target named in the coverage report. Add `reason` when `lines` falls below `coverage.lines`.
Then run `gspot apply` and `gspot check --only swift-tests/coverage`. Write these records by hand;
`gspot set` writes no record lists.

Xcode coverage needs macOS, the `xcode` configuration, and `xcode.project` and `xcode.scheme` in `gspot.toml`.
`gspot init` writes the ones it finds.

## Test files

```shell
gspot set test_files "tests/**/*.test.ts"
```

`test_files` identifies test files for test rules. It does not exclude those files. A scope can declare its own patterns.
