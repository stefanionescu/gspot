---
title: "Dependencies"
description: "Dependency health: known advisories, one version for each dependency, exact pins, one package manager, and a lockfile that matches its manifest."
---

Dependency health: known advisories, one version for each dependency, exact pins, one package manager, and a lockfile that matches its manifest.

Kind: concern. Selected by default.

## Tools

- osv-scanner 2.6.0
- syncpack 15.3.3

## Generated configuration

- `.gspot/osv-scanner.toml`
- `.gspot/syncpack.json`

## Checks

| Check                                                                      | Stage  | What it finds                                                                                                                 |
| -------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [`dependencies/osv`](/reference/rules/dependencies/osv/)                   | push   | Looks up every locked dependency in the Open Source Vulnerabilities (OSV) advisory database.                                  |
| [`dependencies/syncpack`](/reference/rules/dependencies/syncpack/)         | push   | Checks that every workspace package resolves each dependency to one version.                                                  |
| [`integrity/manifest-policy`](/reference/rules/integrity/manifest-policy/) | commit | Checks every package.json: exact versions, one packageManager across the workspace, a private root, and one kind of lockfile. |
| [`integrity/lockfile-fresh`](/reference/rules/integrity/lockfile-fresh/)   | push   | Checks that every lockfile matches its manifest, by asking the package manager to install from it without changing it.        |

## Settings

- `tools.osv.ignore`: Advisories accepted until a review date: the id, the reason, and that date.
- `tools.dependencies.ranges_allowed`: Manifests that may hold version ranges, such as a library others install, each with a reason.

## Rule files

- `general/code/DEPENDENCIES.md`
