---
title: Tests and coverage
description: Run your test suite with a coverage floor, and check Swift tests.
---

gspot runs your test suite as a check at the push stage and fails it when coverage falls below
the floor you set. Keep the test runner and its dependencies in your own project.

The default floors are 0% at `recommended` and 80% at `all`. A floor you set applies at both
levels. For a test runner without a kit, write a [custom check](/guides/project-checks/).

## Jest

Select the `jest` kit, then run the coverage check:

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
[policy reference](/reference/configuration/) lists every coverage setting.

The JavaScript and TypeScript lint checks report focused, disabled, and invalid tests at both
levels. When your tests import from `bun:test`, set `tools.jest.test_module = "bun:test"`
so the lint rules recognize them. That setting changes linting only; the coverage check still
runs Jest.

## Vitest

Select the `vitest` kit, with Vitest and its coverage provider installed in your project. Then
run:

```bash
gspot check --only vitest/coverage
```

Set the floors under `tools.vitest.coverage`: `lines`, `branches`, `functions`, and
`statements`. When your Vitest configuration lives outside the usual paths, set
`tools.vitest.config`. Paths are relative to the scope.

## Python

Select the `pytest` kit, and install pytest and pytest-cov in your project's `.venv`. Then run:

```bash
gspot check --only pytest/coverage
```

`tools.pytest.coverage.lines` sets the line coverage floor. The check runs pytest with strict markers
and strict configuration. The Ruff rules for pytest apply to your test files, and your
application code keeps its own rules.

## Swift tests

Select the `xctest` kit. gspot writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder
that turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, while your
source files keep those rules. Run `swiftlint lint` from the scope without `--config`, because
SwiftLint ignores nested configuration when you pass one.

Snapshot references follow `tools.xctest.reference_layout`, by default
`__Snapshots__/{file}/{test}.*` beside the test file. The [xctest kit](/reference/kits/xctest/)
lists the checks of Swift tests.
