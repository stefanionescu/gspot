# `xctest`

Kind: tool. Requires: swift. macOS only. Every check here passes as a platform skip elsewhere.
Covers XCTest, Swift Testing and snapshot tests (D-93).

## Detects and claims

|        |                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| Detect | a `.swift` file with `import XCTest` or `import Testing`; a `*.xctestplan`; a test target in `Package.swift` |
| Claims | `.swift` files under a folder named `Tests` or ending in `Tests`, `__Snapshots__/**`, and `*.xctestplan`     |

## Tools

swiftlint (from swift), xcodebuild (host). No tool of its own.

## Generated configuration

`.gspot/swiftlint.yml` gains, over the claimed files, the five test rules of the swift preset
(`balanced_xctest_lifecycle`, `empty_xctest_method`, `final_test_case`, `test_case_accessibility`,
`xct_specific_matcher`) and turns `force_unwrapping`, `missing_docs` and `no_magic_numbers` off
there. The preset writes a nested SwiftLint file into each test folder it claims, with `parent_config`
set to the file under `.gspot/` (K-256).

## Checks

| Id                        | Stage       | Command                                                                                                                                                                                                      |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `xctest/disabled`         | commit      | engine: `XCTSkip`, `.disabled(`, `@available(*, unavailable)` on a test, and a `skippedTests` entry in a test plan each carry a reason on the same line or the line above, and the count enters the baseline |
| `xctest/no-sleep`         | commit      | engine: no `sleep(`, `usleep(`, `Thread.sleep` or `Task.sleep` in a claimed file outside `[tools.xctest] sleep_allowed`                                                                                      |
| `xctest/recording`        | commit      | engine: no `isRecording = true`, `record: true`, `record: .all` or `withSnapshotTesting(record:` set to a recording mode in a tracked file                                                                   |
| `xctest/reference-images` | commit      | engine: every file under `__Snapshots__/<TestClass>/` names a test class that exists; every reference image is tracked, under LFS when it passes `limits.file_size_kb`                                       |
| `xctest/coverage`         | push, build | `xcodebuild test -enableCodeCoverage YES`, then `xcrun xccov view --report --json`; line coverage at or above `[tools.xctest] coverage` for each target it names                                             |
| `xcode/test-plan`         | commit      | from the xcode preset                                                                                                                                                                                        |

## Settings

`tools.xctest.coverage` (target, percent; no target named means the check does not run),
`tools.xctest.sleep_allowed` (paths, reason), `tools.xctest.reference_directories` (default
`__Snapshots__`).

## Rule files

`tool/xctest/XCTEST.md`, `general/code/TESTING.md`.
