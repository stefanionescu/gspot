---
title: "Swift"
description: "Swift sources: SwiftLint with the opt-in and analyzer rules, SwiftFormat, a build, and Periphery for dead code."
---

Swift sources: SwiftLint with the opt-in and analyzer rules, SwiftFormat, a build, and Periphery for dead code.

Kind: language. Requires: `formatting`.

## Tools

- swiftlint 0.63.2
- swiftformat 0.61.1
- periphery 3.6.0
- xcodebuild

## Generated configuration

- `.gspot/swiftlint.yml`
- `.gspot/swiftformat`
- `.gspot/periphery.yml`

## Checks

| Check                                                                  | Stage  | What it finds                                                                                                                  |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [`swift/swiftlint`](/reference/rules/swift/swiftlint/)                 | commit | Lints every Swift file with the shipped SwiftLint rule set, with every warning an error.                                       |
| [`swift/swiftformat`](/reference/rules/swift/swiftformat/)             | commit | Checks the layout of every Swift file against the shipped SwiftFormat rules.                                                   |
| [`swift/build`](/reference/rules/swift/build/)                         | push   | Builds the package or the Xcode scheme, and keeps the compiler log for the analyzer.                                           |
| [`swift/swiftlint-analyze`](/reference/rules/swift/swiftlint-analyze/) | push   | Runs the SwiftLint analyzer rules over the compiler log of the build: unused imports, unused declarations, captured variables. |
| [`swift/periphery`](/reference/rules/swift/periphery/)                 | push   | Scans the built project for declarations nothing uses.                                                                         |

## Settings

- `tools.swiftlint.keep_imports`: Imports the analyzer keeps although it sees no use of them.
- `tools.swiftformat.swift_version`: The Swift version SwiftFormat formats for.
- `tools.xcode.project`: The Xcode project or workspace, relative to the scope; empty builds the Swift package.
- `tools.xcode.scheme`: The shared scheme the build, the analyzer, and Periphery use.
- `tools.xcode.destination`: The xcodebuild destination.

## Rule files

- `language/SWIFT.md`
- `language/naming/SWIFT.md`
