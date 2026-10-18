# Xcode

Read this rule when you change Xcode project settings, schemes, or build phases.

## Project settings

- `SWIFT_STRICT_CONCURRENCY = complete`. Set adopted upcoming-feature flags in
  the project, not per file.
- Share schemes needed by collaborators and CI. Keep personal scheme state out of the repository.
- Set each deployment target in the project, to the oldest system version the product supports. An extension,
  framework, or package dependency never requires a newer system than the app that ships it.

## Files

- Keep source and resource membership consistent with the intended targets. Avoid duplicate
  build entries; preserve synchronized groups where the project uses them.
- Put images and named colors in asset catalogs when the platform supports their required format.
  Keep other resources in the appropriate bundle locations.
- `Info.plist` values that vary by configuration come from build settings
  such as `$(PRODUCT_BUNDLE_IDENTIFIER)`, not from edited plist copies.

## Build phases and scripts

- Run-script phases declare their interpreter and pass the checks for that language.
- Every run-script phase declares its input and output files so the build system can skip it.
- No network access or code generation without declared outputs.
- The linter and the formatter run before commit, not as phases that fail the build twice.

## Project organization

<!-- level: all -->

Keep shared build settings in the project or `.xcconfig` file. A target overrides only
what differs. Preserve the project's chosen modules and packages; do not introduce
one only to enforce a folder layout. Keep substantial build-script logic in a
repository file its language tools can check.
