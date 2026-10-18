---
title: Swift
description: Lint, format, build, and test Swift packages and Xcode projects.
---

Use the [Quickstart](/start/quickstart/) with mise for a Swift package. Install the Swift toolchain first.

SwiftLint checks source files. SwiftFormat formats them.

## Swift tests

Run `gspot add swift-tests`. gspot writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder
that turns off `force_unwrapping`, `missing_docs`, and `no_magic_numbers` in tests, while your
source files keep those lint rules. `gspot check --only swift/swiftlint` reads these nested files. In an editor, run SwiftLint without `--config`, because that option turns off the nested files.

[swift-tests](/reference/configurations/swift-tests/) declares checks for test reasons and coverage.

To set a line coverage limit for a Swift target:

```toml
[[coverage.swift_target]]
name = "Orders"
lines = 80
```

Replace `Orders` with the target named in the coverage report. Add `reason` when `lines` falls below `coverage.lines`.
Then run `gspot apply` and `gspot check --only swift-tests/coverage`. Write these records by hand;
`gspot set` writes no record lists.

## Xcode projects

Xcode checks need macOS and Xcode selected with `xcode-select`. Xcode coverage also needs the `xcode` configuration,
plus `swift.xcode_project` and `swift.xcode_scheme` in `gspot.toml`. `gspot init` writes the ones it finds.
