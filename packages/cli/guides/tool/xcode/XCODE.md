---
layer: tool
kit: xcode
title: Xcode
---

# Xcode

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Project settings

- Warnings are errors: `SWIFT_TREAT_WARNINGS_AS_ERRORS = YES` and
  `GCC_TREAT_WARNINGS_AS_ERRORS = YES` in every configuration.
- `SWIFT_STRICT_CONCURRENCY = complete`. Upcoming-feature flags the project adopts are set in
  the project, not per file.
- Share schemes needed by collaborators and CI. Keep personal scheme state out of the repository.
- Set deployment targets deliberately for each supported product. Verify compatibility
  between apps, extensions, frameworks, and package dependencies.

## Files

- Keep `xcuserdata/`, `DerivedData/`, and `*.xcuserstate` out of source control.
  Preserve the committed `Package.resolved` used by the application's immutable dependency setup.
- Keep source and resource membership consistent with the intended targets. Avoid duplicate
  build entries; preserve synchronized groups where the project uses them.
- Put images and named colors in asset catalogs when the platform supports their required format.
  Keep other resources in the appropriate bundle locations.
- `Info.plist` values that vary by configuration come from build settings
  (`$(PRODUCT_BUNDLE_IDENTIFIER)`), not from edited plist copies.

## Build phases and scripts

- Run-script phases declare their interpreter and pass the checks for that language.
- Every run-script phase declares its input and output files so the build system can skip it.
- No network access, no code generation without declared outputs, and no `try!` or force unwrap
  in build tooling.
- The linter and the formatter run before commit, not as build phases that fail the build twice.

## Packages

- Dependencies are Swift packages pinned to an exact version or revision. No branch dependencies
  in a release build.

## Project organization

<!-- level: all -->

Keep shared build settings in their project or `.xcconfig` owner. A target overrides only
what differs. Preserve the project's chosen modules and package boundaries; do not introduce
a package only to enforce a directory layout. Keep substantial build-script logic in a
repository file its language tools can check.
