---
title: Check tests and coverage
description: Configure Jest coverage and Swift test checks without weakening source rules.
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

## Jest coverage

Select the `jest` preset for a project that runs Jest. Keep Jest and its test dependencies in
the project. `gspot install` installs the ESLint plugin in the private tool directory.
JavaScript and TypeScript lint checks report focused, disabled, and invalid tests at both levels.

Run coverage at the push stage:

```bash
gspot check --stage push --only jest/coverage --no-cache
```

The check runs Jest in a disposable source copy. It preserves working-tree sources and reports.
Each coverage dimension defaults to 80 percent. To require full function coverage:

```bash
gspot set tools.jest.coverage_functions 100
```

Use `--scope app` when `app` is a declared scope. The selected project supplies its Jest
configuration and tests. Failed assertions and coverage shortfalls return status 1; a suite
that cannot load or a missing report returns status 2.

`tools.jest.global_package = "bun:test"` lets the ESLint rules recognize Bun test imports.
It also accepts the optional failure message in Bun `expect` calls while rejecting extra arguments.
This setting affects linting; the coverage check still runs Jest.

## Swift tests

Select `xctest` to generate a nested `.swiftlint.yml` for each claimed `Tests` or `*Tests`
folder. These files disable `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in
tests. Source files retain those rules. Nested policy scopes retain their own configuration.

gspot runs SwiftLint from the selected scope using native configuration discovery. For an
editor or standalone invocation, run `swiftlint lint` from that scope without `--config`:
[SwiftLint ignores nested configuration when that argument is present](https://github.com/realm/SwiftLint/blob/0.63.2/README.md#nested-configurations).
Run `gspot apply` to restore a missing generated pointer file.

The `doc_comment_style` rule requires `///` documentation comments instead of block
documentation comments. It preserves ordinary block comments and comment markers inside strings.

Static test checks recognize imports of `XCTest` or `Testing`, and `@Test` or `@Suite`
attributes, including files outside test folders. Imports and attributes inside strings or
comments do not select tests. A package test target also proposes the `xctest` preset.
Put a skip reason in the `XCTSkip` or `.disabled` argument. Missing, empty, and whitespace-only
literal reasons are findings. Sleep allowances apply within their declared policy scope.

Snapshot references use `tools.xctest.reference_layout`, defaulting to
`__Snapshots__/{file}/{test}.*`, relative to the test file directory. `{file}` is the Swift
filename without its extension, and `{test}` is the test name. `*` and `?` match characters
within a path segment. Set a different layout in a policy scope for a custom snapshot
directory. A Swift file in another directory does not satisfy a reference owner.

### Xcode source membership

Xcode source membership follows file references through their group paths and source build
phases. Display names do not change paths. Projects in a policy scope share the source
membership check, and nested policy scopes are checked separately. Synchronized groups
honor their target membership exclusions. A source path that requires unresolved build
settings returns an execution error rather than an incomplete membership result.
