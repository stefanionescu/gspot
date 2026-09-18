---
layer: tool
preset: xcode
title: Xcode
---

# Xcode

## Project settings

- Warnings are errors: `SWIFT_TREAT_WARNINGS_AS_ERRORS = YES` and
  `GCC_TREAT_WARNINGS_AS_ERRORS = YES` in every configuration.
- `SWIFT_STRICT_CONCURRENCY = complete`. Upcoming-feature flags the project adopts are set in
  the project, not per file.
- Build settings live in the project or in `.xcconfig` files, one per configuration, never
  duplicated across targets. A target overrides only what differs.
- One scheme per product, shared, checked in. No personal schemes in the repository.
- The deployment target is set once per platform and every target agrees.

## Files

- `xcuserdata/`, `DerivedData/`, `*.xcuserstate`, and `Package.resolved` for apps that do not
  pin (or committed, when they do, as a decision) follow the repository's ignore file; nothing
  user-specific is committed.
- Groups mirror directories. A file that exists on disk is in the project once, in the group that
  matches its path.
- Resources are in asset catalogs; colors and images are referenced by name, never by literal.
- `Info.plist` values that vary by configuration come from build settings
  (`$(PRODUCT_BUNDLE_IDENTIFIER)`), not from edited plist copies.

## Build phases and scripts

- Run-script phases call a script file in the repository that passes ShellCheck; the phase body
  is one line.
- Every run-script phase declares its input and output files so the build system can skip it.
- No network access, no code generation without declared outputs, and no `try!` or force unwrap
  in build tooling.
- The linter and the formatter run before commit, not as build phases that fail the build twice.

## Packages

- Dependencies are Swift packages pinned to an exact version or revision. No branch dependencies
  in a release build.
- A local package is the unit of modularity for domain and platform code; the app target holds
  composition and UI only.
