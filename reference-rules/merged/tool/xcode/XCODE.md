---
layer: tool
preset: xcode
title: Xcode
---

# Xcode

## Project settings

- Warnings are errors: `SWIFT_TREAT_WARNINGS_AS_ERRORS = YES` and
  `GCC_TREAT_WARNINGS_AS_ERRORS = YES` in every configuration. `enforced-by: config-files/plist`
- `SWIFT_STRICT_CONCURRENCY = complete`. Upcoming-feature flags the project adopts are set in
  the project, not per file. `enforced-by: config-files/plist`
- Build settings live in the project or in `.xcconfig` files, one per configuration, never
  duplicated across targets. A target overrides only what differs. `enforced-by: config-files/plist`
- One scheme per product, shared, checked in. No personal schemes in the repository. `enforced-by: config-files/plist`
- The deployment target is set once per platform and every target agrees. `enforced-by: config-files/plist`

## Files

- `xcuserdata/`, `DerivedData/`, `*.xcuserstate`, and `Package.resolved` for apps that do not
  pin (or committed, when they do, as a decision) follow the repository's ignore file; nothing
  user-specific is committed. `enforced-by: config-files/plist`
- Groups mirror directories. A file that exists on disk is in the project once, in the group that
  matches its path. `enforced-by: config-files/plist`
- Resources are in asset catalogs; colours and images are referenced by name, never by literal. `enforced-by: config-files/plist`
- `Info.plist` values that vary by configuration come from build settings
  (`$(PRODUCT_BUNDLE_IDENTIFIER)`), not from edited plist copies. `enforced-by: config-files/plist`

## Build phases and scripts

- Run-script phases call a script file in the repository that passes ShellCheck; the phase body
  is one line. `enforced-by: config-files/plist`
- Every run-script phase declares its input and output files so the build system can skip it. `enforced-by: config-files/plist`
- No network access, no code generation without declared outputs, and no `try!` or force unwrap
  in build tooling. `enforced-by: config-files/plist`
- SwiftLint and SwiftFormat run through the gate, not as build phases that fail the build twice. `enforced-by: config-files/plist`

## Packages

- Dependencies are Swift packages pinned to an exact version or revision. No branch dependencies
  in a release build. `enforced-by: config-files/plist`
- A local package is the unit of modularity for domain and platform code; the app target holds
  composition and UI only. `enforced-by: config-files/plist`
