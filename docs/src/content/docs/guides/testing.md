---
title: Tests and coverage
description: Run your test suite with a coverage floor, and check Swift tests.
---

gspot runs your test suite as a check at the push stage and fails it when coverage falls below
the floor you set. Keep the test runner and its dependencies in your own project.

The default floors are 0% at `recommended` and 80% at `all`. A floor you set applies at both
levels. For a test runner without a kit, write a [custom check](/guides/custom-checks/).

## Jest

Select the `jest` kit, then run the coverage check:

```bash
gspot check --stage push --only jest/coverage
```

The check runs Jest in a copy of your sources, so your working tree and reports stay as they
are. Failed tests and missed floors exit with `1`. A suite that cannot load, or a missing
report, exits with `2`.

To require full function coverage:

```bash
gspot set tools.jest.coverage_functions 100
```

Add `--scope app` to set it for the scope `app` only. The
[policy reference](/reference/configuration/) lists every coverage setting.

The JavaScript and TypeScript lint checks report focused, disabled, and invalid tests at both
levels. When your tests import from `bun:test`, set `tools.jest.test_module = "bun:test"`
so the lint rules recognize them. That setting changes linting only; the coverage check still
runs Jest.

## Vitest

Select the `vitest` kit, with Vitest and its coverage provider installed in your project. Then
run:

```bash
gspot check --stage push --only vitest/coverage
```

Set the floors with `tools.vitest.coverage_lines`, `coverage_branches`, `coverage_functions`,
and `coverage_statements`. When your Vitest configuration lives outside the usual paths, set
`tools.vitest.config`. Paths are relative to the scope.

## Python

Select the `pytest` kit, and install pytest and pytest-cov in your project's `.venv`. Then run:

```bash
gspot check --stage push --only pytest/coverage
```

`tools.pytest.coverage` sets the line coverage floor. The check runs pytest with strict markers
and strict configuration. The Ruff rules for pytest apply to your test files, and your
application code keeps its own rules.

## Swift tests

Select the `xctest` kit. gspot writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder.
It turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, and your
source files keep those rules.

To run SwiftLint yourself or in an editor, run `swiftlint lint` from the scope, without
`--config`.
[SwiftLint ignores nested configuration when you pass `--config`](https://github.com/realm/SwiftLint/blob/0.63.2/README.md#nested-configurations).
If a nested `.swiftlint.yml` goes missing, `gspot apply` writes it again.

The Swift test checks:

- recognize a test file by an import of `XCTest` or `Testing`, or by the `@Test` or `@Suite`
  attributes, even outside test folders
- require a reason in each `XCTSkip` or `.disabled` argument
- require `///` documentation comments instead of block documentation comments

Snapshot references follow `tools.xctest.reference_layout`, by default
`__Snapshots__/{file}/{test}.*`, relative to the test file. `{file}` is the Swift file name
without its extension, and `{test}` is the test name. Set another layout in a scope for a
different snapshot folder.

## Xcode source membership

The source membership check follows the file references and build phases of each Xcode project.
Synchronized groups keep their target exclusions. When a source path depends on a build setting
gspot cannot resolve, the check fails with an error instead of a partial result.
