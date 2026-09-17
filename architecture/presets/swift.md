# swift

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

| | |
| --- | --- |
| Detect | `.swift` in the tree; `Package.swift`; `*.xcodeproj` |
| Claims | `.swift`, `Package.swift`, `Package.resolved` |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling |

## Tools

swiftlint, swiftformat, periphery, xcodebuild (host), swift (host).

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/swiftlint.yml` | `.swiftlint.yml` with `parent_config` | the 87 opt-in rules, 4 analyzer rules, limits from `[limits]`, `identifier_name` and `type_name` off, `missing_docs` on open and public, `explicit_acl`, `explicit_top_level_acl`, `private_over_fileprivate`, `file_name_no_space`, `file_header`, custom rules for `///` and banned-term regexes as a second line of defence |
| `.gspot/swiftlint.tests.yml` | none | the snapshot-test config from `[tools.swiftlint.extra_configs]` |
| `.gspot/swiftformat` | `.swiftformat` | the enabled and disabled rule lists, options from `[format]` |
| `.gspot/periphery.yml` | none | project, schemes, retain options |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `swift/swiftlint` | commit | `swiftlint lint --strict --quiet --config .gspot/swiftlint.yml {files}` |
| `swift/swiftformat` | commit | `swiftformat --lint --config .gspot/swiftformat {files}`; fix order format |
| `swift/build` | push, build | `xcodebuild build-for-testing` or `swift build`, log kept for analyze |
| `swift/swiftlint-analyze` | push, build | `swiftlint analyze --strict --compiler-log-path <log>` |
| `swift/periphery` | push, build | `periphery scan --config .gspot/periphery.yml --strict` |
| `structure/trivial-function`, `call-through`, `duplicate-functions`, `single-file-folder`, `prefix-collisions`, `file-directory-collision` | commit | engine |
| `structure/private-before-public` | commit | `private` and `fileprivate` top-level declarations above `internal`, `public` and `open` ones |
| `structure/env-access-owner` | commit | `ProcessInfo.processInfo.environment` read only in the configuration owner |

Every check here is a platform skip on Linux and Windows.

The five SwiftLint rules the reference repository measured and left off (`no_magic_numbers`,
`type_contents_order`, `one_declaration_per_file`, `file_types_order`, `no_empty_block`) are on
and enter with a baseline.

## Settings

`tools.swiftlint.disabled` (reason), `tools.swiftlint.extra_configs`, `tools.swiftformat.options`,
`tools.periphery.retain`, `tools.xcodebuild.scheme`, `tools.xcodebuild.destination`.

## Rule files

`language/SWIFT.md`, `language/naming/SWIFT.md`; `framework/swiftui/SWIFTUI.md` and
`framework/uikit/UIKIT.md` when the corresponding import appears in the sources.

## Not covered here

Package dependency scanning: osv-scanner has no `Package.resolved` extractor. The dependencies
preset reports the gap.
