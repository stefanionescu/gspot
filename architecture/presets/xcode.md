# `xcode`

Kind: tool. Requires: swift, config-files. macOS only; every check here passes as a platform skip
elsewhere.

## Detects and claims

|                         |                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | `*.xcodeproj`, `*.xcworkspace`                                                                                                                                                               |
| Claims                  | `project.pbxproj`, `*.xcscheme`, `*.xctestplan`, `*.xcconfig`, `*.entitlements`, `Info.plist` and other `.plist`, `*.xcstrings`, `*.storyboard`, `*.xib`, `Assets.xcassets/**/Contents.json` |
| Architecture it assumes | none. Does not assume MVVM.                                                                                                                                                                  |

## Tools

xcodebuild, plutil, xcstringstool (host); xcodegen optional.

## Checks

| Id                          | Stage  | Command                                                                                                                                                                |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xcode/plist`               | commit | `plutil -lint` over every plist and entitlements file                                                                                                                  |
| `xcode/xcconfig`            | commit | key = value lines; no secret values (gitleaks allowlist for public client identifiers with reasons)                                                                    |
| `xcode/xcstrings`           | commit | `xcstringstool` validates; translation completeness per locale against the base                                                                                        |
| `xcode/asset-catalogues`    | commit | `Contents.json` validates against the catalogue schema; every image set has an image; no orphan asset referenced by no Swift source (`[tools.xcode] asset_references`) |
| `xcode/test-plan`           | commit | every scheme has a test plan; every test target is in a plan                                                                                                           |
| `xcode/orphan-sources`      | commit | the symmetric difference between Swift files in the tree and files in any target: in the tree and no target fails; in a target and not the tree fails                  |
| `xcode/symlinks`            | commit | a tracked symlink inside the project is reported with its target                                                                                                       |
| `xcode/entitlements-policy` | commit | entitlements limited to `[tools.xcode] allowed_entitlements`                                                                                                           |
| `xcode/ats`                 | commit | no `NSAllowsArbitraryLoads` without an `[[ignore]]` reason                                                                                                             |

## Settings

`tools.xcode.project`, `tools.xcode.scheme`, `tools.xcode.destination`, `tools.xcode.allowed_entitlements`,
`tools.xcode.orphan_assets` (default `true`: a source names each asset as a string literal or as
the symbol Xcode writes for it).

## Rule files

`tool/xcode/XCODE.md`.
