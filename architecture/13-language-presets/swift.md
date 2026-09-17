# `language:swift`

The weakest-covered language in the reference set. The audit's first blind spot: "iOS has no static
analysis, no SAST and no dependency scan in any hook."

## Claims

```text
language:swift      .swift
                    Package.swift, Package.resolved
tool:xcode   *.xcodeproj/**, *.xcworkspace/**, .xcconfig, .entitlements,
                    .plist, .xcstrings, .storyboard, .xib, .xctestplan,
                    Assets.xcassets/**
```

The split matters: a Swift package has no Xcode project, and an app has both.

## Tools

| Kind        | Tool                                           | Notes                                                                                                  |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| format            | `swiftformat`                                  |                                                                                                        |
| style             | `swiftlint lint --strict`                      | Requires nothing, therefore pre-commit. The reference repository runs it in no hook at all. |
| style, deeper     | `swiftlint analyze --strict`                   | Requires `build`, a compilation database, therefore pre-push                                         |
| types, syntax     | `xcodebuild build` or `swift build`            |                                                                                                        |
| structure, naming | gspot structure engine, ast-grep Swift grammar | The reference repository planned this and left `quality/functions/swift.js` dead                       |
| dead              | `periphery --strict`                           | Requires `build`                                                                                           |
| prose             | Vale, native Swift grammar                     |                                                                                                        |
| sast              | `semgrep` with the Swift rule set              | 14 rules exist in the reference tree and run nowhere                                                   |
| deps              | `osv-scanner` over `Package.resolved`          | See the gap below                                                                                      |
| secrets           | gitleaks, trufflehog                           | The only two tools that see `ios/` today                                                               |
| duplication       | `jscpd`                                        | 25 of 119 qlty smell findings are in `ios`                                                             |

### The dependency gap

`osv-scanner` has no extractor for `Package.resolved`, which the reference audit records. The preset's
answer: parse `Package.resolved` (a documented JSON format with `identity`, `location` and
`revision` per pin) and query the OSV API with the resolved versions. That is a real gap with a real
fix, and it is the one place a language preset adds a scanner rather than configuring one.

`tool:xcode` additionally asserts that `Package.resolved` is tracked and that its pins match
the project's declared requirements, which nothing checks today.

## SwiftLint configuration

The reference repository runs 87 opt-in rules plus 4 analyzer rules, and measured four more rule
sets and left them off:

| Rule                       | Findings | Preset behaviour                                                           |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `no_magic_numbers`         | 921      | Baseline                                                                 |
| `one_declaration_per_file` | 294      | Baseline. Implies file splitting, so the count falls slowly.             |
| `type_contents_order`      | 426      | Baseline                                                                 |
| `file_types_order`         | 93       | Baseline                                                                 |
| `no_empty_block`           | 28       | On immediately                                                           |

Two configurations exist in the reference repository, for the app and for the snapshot tests, and
`swiftlint analyze` runs against the app config only, so the four analyzer rules never touch
`Tests/Snapshot`. Under gspot, every config the preset emits is covered by every task that uses it,
and the coverage check proves it: the snapshot test files claim `style` from the analyzer check or
they are `partial`.

Custom rules the preset ships, each replacing a prose rule with an enforcement:

| Rule                            | Enforces                                             |
| ------------------------------- | ---------------------------------------------------- |
| `doc_comment_style`             | `///` and not `/** */`, from the documentation rules |
| `no_print`                      | `print` outside debug builds                         |
| `no_force_unwrap_outside_tests` | Beyond SwiftLint's own `force_unwrapping`, scoped    |

## The Xcode project

The second blind spot, and the largest single class of unchecked files. `repository:configuration` and
`tool:xcode` together close it:

| File class                         | Count in reference | Check                                                                                                                                                              |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `project.pbxproj`                  | 1                  | Parse and validate: every source file reference resolves, no duplicate build file entries, no absolute paths, no missing group. Plus the orphan-source diff below. |
| `.xcconfig`                        | 4                  | Key syntax, no duplicate keys across the inheritance chain, no secret-shaped values, required keys present                                                         |
| `.entitlements`                    | 4                  | `plutil -lint`, plus a policy check: no wildcard app group, no `get-task-allow` in a release configuration                                                         |
| `.plist`                           | 2                  | `plutil -lint`, plus required-key policy                                                                                                                           |
| `.xcstrings`                       | 3                  | `xcstringstool` validation, plus a translation completeness check per locale                                                                                       |
| `.storyboard`, `.xib`              | 1                  | XML well-formedness, plus an unused-scene check                                                                                                                    |
| `.xctestplan`                      | 1                  | Schema, plus an assertion that every test target appears in a plan                                                                                                 |
| `Assets.xcassets/**/Contents.json` | 28                 | Schema against the documented asset catalogue format. `repository:assets` additionally checks orphan images and dimension policy.                                  |
| Schemes                            | several            | Shared schemes are tracked, and every scheme's build action references an existing target                                                                          |

### Orphan source detection

The check no reference tool performs. `swiftlint` lints files it is pointed at; `xcodebuild`
compiles files the project lists. The symmetric difference is a bug class:

```text
in the tree, not in any target  -> orphan-source, fails
in a target, not in the tree    -> broken project reference, fails
```

The file listing is `xcodebuild -showBuildSettings` plus the target file lists, or
`swift package describe --type json` for a package. See [../05-coverage.md](../05-coverage.md).

### The tracked symlink

`ios/Yap/Services` is a tracked symlink to `Info.plist`. The coverage check resolves and reports
symlinks rather than following them silently, because a source directory that is a symlink to a
plist is a fact somebody needs to see.

## Required inspections

```text
.swift          format syntax style types structure naming prose spelling
Package.swift   format syntax style types spelling
.xcconfig       syntax schema spelling security
.entitlements   syntax schema spelling
.plist          syntax schema spelling
.xcstrings      syntax schema spelling
project.pbxproj syntax schema
```

`project.pbxproj` gets no `spelling`: the reference repository excludes it from `typos` because the
format is full of hashes, and that exclusion is correct. It is expressed as the absence of
`spelling` from the required inspections, not as a `typos` ignore, so the coverage check does not report it as
weak.

## Totality

| Habit                                 | Reference evidence                                                                         | gspot                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Only the app target is linted         | `swiftlint analyze` runs with the app config only; `Tests/Snapshot` gets no analyzer rules | Every emitted config is covered by a task, asserted by the coverage check                                         |
| Snapshot images are invisible         | `__Snapshots__/` excluded from `typos`; 982 PNG files seen by secret scanners only         | `binary` status plus `repository:assets`: size ceiling, orphan detection against source references, naming policy |
| The project file is nobody's business | Checked by nothing                                                                         | Claimed by `tool:xcode`                                                                                    |
| Swift has no dependency scanning      | `osv-scanner` has no `Package.resolved` extractor                                          | Preset-provided extractor plus OSV query                                                                            |
| iOS SAST is configured and unwired    | 14 Semgrep rules, zero invocations                                                         | `repository:vulnerabilities` runs them, and an unwired rule file fails as an orphan                               |
