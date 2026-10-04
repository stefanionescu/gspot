---
title: Xcode
---

# Xcode

## Project settings

- `SWIFT_STRICT_CONCURRENCY = complete`. Upcoming-feature flags the project adopts are set in
  the project, not per file.
- Share schemes needed by collaborators and CI. Keep personal scheme state out of the repository.
- Set deployment targets deliberately for each supported product. Verify compatibility
  between apps, extensions, frameworks, and package dependencies.

## Files

- Keep source and resource membership consistent with the intended targets. Avoid duplicate
  build entries; preserve synchronized groups where the project uses them.
- Put images and named colors in asset catalogs when the platform supports their required format.
  Keep other resources in the appropriate bundle locations.
- `Info.plist` values that vary by configuration come from build settings
  (`$(PRODUCT_BUNDLE_IDENTIFIER)`), not from edited plist copies.

## Build phases and scripts

- Run-script phases declare their interpreter and pass the checks for that language.
- Every run-script phase declares its input and output files so the build system can skip it.
- No network access or code generation without declared outputs.
- The linter and the formatter run before commit, not as build phases that fail the build twice.

## Project organization

<!-- level: all -->

Keep shared build settings in their project or `.xcconfig` owner. A target overrides only
what differs. Preserve the project's chosen modules and package boundaries; do not introduce
a package only to enforce a directory layout. Keep substantial build-script logic in a
repository file its language tools can check.
