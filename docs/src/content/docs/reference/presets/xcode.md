---
title: "Xcode"
description: "An Xcode project: property lists that parse, build settings files, and complete string catalogs. Asset catalogs hold their images, test targets sit in a plan, sources belong to a target, and entitlements stay on a list."
---

An Xcode project: property lists that parse, build settings files, and complete string catalogs. Asset catalogs hold their images, test targets sit in a plan, sources belong to a target, and entitlements stay on a list.

Kind: tool. Requires: `config-files`.

## Tools

- plutil

## Checks

| Check                                                                      | Stage  | What it finds                                                                                                                         |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`xcode/plist`](/reference/rules/xcode/plist/)                             | commit | Asks plutil whether every property list and entitlements file parses.                                                                 |
| [`xcode/xcconfig`](/reference/rules/xcode/xcconfig/)                       | commit | Checks that every line of a build settings file is a setting, an include, or a comment.                                               |
| [`xcode/xcstrings`](/reference/rules/xcode/xcstrings/)                     | commit | Checks that every string catalog parses, and that every string has a translation for every locale the catalog uses.                   |
| [`xcode/asset-catalogues`](/reference/rules/xcode/asset-catalogues/)       | commit | Checks that every asset Contents.json parses, that every image set holds the images it names, and that some source names every asset. |
| [`xcode/test-plan`](/reference/rules/xcode/test-plan/)                     | commit | Checks that every shared scheme that runs tests names a test plan, and that every test target is in a plan.                           |
| [`xcode/orphan-sources`](/reference/rules/xcode/orphan-sources/)           | commit | Compares the Swift files in the tree with the files the project names: a file in no target, and a target file that is gone.           |
| [`xcode/symlinks`](/reference/rules/xcode/symlinks/)                       | commit | Reports every tracked symlink beside or under an Xcode project, with where it points.                                                 |
| [`xcode/entitlements-policy`](/reference/rules/xcode/entitlements-policy/) | commit | Checks that every entitlement is on tools.xcode.allowed_entitlements, when the policy holds that list.                                |
| [`xcode/ats`](/reference/rules/xcode/ats/)                                 | commit | Refuses a property list that allows arbitrary loads, which turns transport security off for every host.                               |

## Settings

- `tools.xcode.allowed_entitlements`: The entitlements the app may hold; empty turns the check off.
- `tools.xcode.orphan_assets`: Whether an asset no source names is a finding.

## Rule files

- `tool/xcode/XCODE.md`
