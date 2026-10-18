---
title: Swift
description: Lint, format, build, and test Swift packages and Xcode projects.
---

SwiftLint lints and SwiftFormat checks the layout at commit. At push, `swift/build` builds the package or Xcode
scheme, and `swift/periphery` reports declarations that nothing uses. The [Swift configuration](/reference/configurations/swift/)
lists every check.

## Before you start

Install the Swift toolchain, then install gspot with mise, as the [Quickstart](/start/quickstart/) shows.

## Xcode projects

When `swift.xcode_project` names a project or workspace, the build, Periphery, analyzer, and coverage checks use it
with `swift.xcode_scheme` and `swift.xcode_destination`. `gspot init` writes the ones it finds. These checks need
macOS with Xcode selected by `xcode-select`; Periphery runs on macOS only. The `xcode` configuration also checks
property lists, build settings files, string catalogs, asset catalogs, and entitlements against
`xcode.allowed_entitlements`; only `xcode/plutil` needs macOS.

`swift/swiftlint-analyze` runs the SwiftLint analyzer on the build log. It runs only on macOS and only when you name
it: run
`gspot check --only swift/swiftlint-analyze`. List an import it flags in error under
`tools.swiftlint.always_keep_imports`.

## Tests

The `swift` configuration also checks your XCTest and Swift Testing tests. gspot writes a `.swiftlint.yml` into each
`Tests` or `*Tests` folder that turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, while your
source files keep those lint rules. `gspot check --only swift/swiftlint` reads these nested files. In an editor, run
SwiftLint without `--config`, because that option turns off the nested files.

[`swift/skip-reasons`](/reference/checks/swift/skip-reasons/) asks each disabled test for a reason.
[`swift/coverage`](/reference/checks/swift/coverage/) measures each target against its coverage floor, and skips a
scope that holds no tests.

## Coverage

To set a line coverage limit for a Swift target:

```toml
[[coverage.swift_target]]
name = "Orders"
lines = 80
```

Replace `Orders` with the target named in the coverage report. Add `reason` when `lines` falls below `coverage.lines`.
Then run `gspot apply` and `gspot check --only swift/coverage`. Write these records by hand;
`gspot set` writes no record lists.

## Security rules

Semgrep also runs the Swift security lint rules of the `swift` configuration on Swift sources and plist files. The
[Swift configuration](/reference/configurations/swift/) lists them.
