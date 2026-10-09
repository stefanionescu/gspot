---
title: Tests and coverage
description: Run your test suite with a coverage floor, and check Swift tests.
---

gspot runs your test suite as a check at the push stage and fails it when coverage falls below
the floor you set. Keep the test runner and its dependencies in your own project.

The default floors for Jest, Vitest, and pytest are 0% at `recommended` and 80% at `all`. Swift uses `coverage.lines` and named `coverage.overrides`. A floor you set applies at both
levels. For a test runner without a configuration, write a [command check](/guides/command-checks/).

## Coverage with `jest`

Run `gspot add jest`, then run the coverage check:

```bash
gspot check --only jest/coverage
```

The check runs Jest in a copy of your sources, so your working tree and reports stay as they
are. Failed tests and missed floors exit with `1`. A suite that cannot load, or a missing
report, exits with `2`.

To require full function coverage:

```bash
gspot set tools.jest.coverage.functions 100
```

Add `--scope app` to set it for the scope `app` only. The
[settings reference](/reference/settings/) lists every coverage setting.

The Jest configuration reports focused, off, and invalid Jest tests at both levels.
It reads test functions from `@jest/globals` and runs Jest for coverage.

## Vitest

Run `gspot add vitest`, with Vitest and its coverage provider installed in your project. Then
run:

```bash
gspot check --only vitest/coverage
```

Set the floors under `tools.vitest.coverage`: `lines`, `branches`, `functions`, and
`statements`. When your Vitest configuration lives outside the usual paths, set
`vitest.config_file`. Paths are relative to the scope.

## Python

Run `gspot add pytest`, and install pytest and pytest-cov in your project's `.venv`. Then run:

```bash
gspot check --only pytest/coverage
```

`tools.pytest.coverage.lines` sets the line coverage floor. The check runs pytest with strict markers
and strict configuration. The Ruff rules for pytest apply to your test files, and your
app code keeps its own rules.

## Swift tests

Run `gspot add swift-tests`. gspot writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder
that turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, while your
source files keep those rules. `gspot check --only swift/swiftlint` reads these nested files. When configuring an editor directly, omit `--config` from SwiftLint because that option disables nested configuration.

The swift-snapshot-testing dependency selects its own configuration. It checks snapshot recording
and the library's `__Snapshots__/{file}/{test}.*` references beside each test source. The
[SnapshotTesting configuration](/reference/configurations/swift-snapshot-testing/) owns these checks.
[swift-tests](/reference/configurations/swift-tests/) owns test reasons, sleeps, and coverage.

To set a line coverage floor for a Swift target:

```shell
gspot set coverage.overrides '{"target":"Orders","percent":80}'
gspot check --only swift-tests/coverage
```

Replace `Orders` with the target named in the coverage report. Swift packages run on macOS and Linux. Xcode coverage requires macOS and a selected `xcode` configuration with `swift.xcode_project` and `swift.xcode_scheme`.
