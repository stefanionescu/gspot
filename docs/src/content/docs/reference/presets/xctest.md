---
title: "Swift Tests"
description: "Swift test files under XCTest, Swift Testing, and snapshot testing. A disabled test says why, no test sleeps, and no snapshot test records. Every reference has its test, and coverage holds a floor."
---

Swift test files under XCTest, Swift Testing, and snapshot testing. A disabled test says why, no test sleeps, and no snapshot test records. Every reference has its test, and coverage holds a floor.

Kind: tool. Requires: `swift`.

## Checks

| Check                                                                  | Stage  | What it finds                                                                                   |
| ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| [`xctest/disabled`](/reference/rules/xctest/disabled/)                 | commit | Checks that every skipped or disabled test gives a reason beside it.                            |
| [`xctest/no-sleep`](/reference/rules/xctest/no-sleep/)                 | commit | Refuses sleep calls in test files outside tools.xctest.sleep_allowed.                           |
| [`xctest/recording`](/reference/rules/xctest/recording/)               | commit | Refuses a snapshot test left in a recording mode.                                               |
| [`xctest/reference-images`](/reference/rules/xctest/reference-images/) | commit | Checks that every folder of snapshot references sits beside a test file of the same name.       |
| [`xctest/coverage`](/reference/rules/xctest/coverage/)                 | push   | Runs the tests with coverage and holds each target named in tools.xctest.coverage to its floor. |

## Settings

- `tools.xctest.coverage`: Coverage floors: a target and the share of lines out of 100. Empty turns the check off.
- `tools.xctest.sleep_allowed`: Test paths that may sleep, each with a reason.
- `tools.xctest.reference_directories`: The folder names that hold snapshot references.

## Rule files

- `tool/xctest/XCTEST.md`
- `general/code/TESTING.md`
