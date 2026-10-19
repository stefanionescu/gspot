---
title: Dependencies and licenses
description: Check vulnerable packages, dependency licenses, and registry hosts.
---

Check dependencies for known vulnerabilities and review the licenses and registry hosts your repository accepts.

## Licenses

An npm `package.json` or Python `pyproject.toml` selects the general `licenses` configuration automatically. It checks the license of every installed npm and Python package at the push
stage. Install your project dependencies first. Python projects use the `.venv` of their scope,
and `gspot install` installs the license scanner.

gspot picks no allowed licenses for you, and scans none until you set `licenses.allowed` or an allowed package. After you review the licenses that your project accepts, list them:

```shell
gspot set licenses.allowed MIT Apache-2.0 BSD-3-Clause
gspot install
gspot check --only licenses/allowed
```

The check keeps the installed packages that the lockfile of the project records: `uv.lock` for Python, and
`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `bun.lock` for npm. A package left in `node_modules` or in the
environment after its removal does not count. Without a lockfile, the check reads every installed package.

A Python package states its license in one of three fields. gspot takes the first that names license IDs:
`License-Expression`, then the `License` metadata, then the trove classifiers, such as `MIT License` for `MIT`.

## Allow a license or one package

Add a license to `licenses.allowed` to allow every package under it. To allow
one package version with a license you reviewed, add a `[[licenses.allowed_package]]` record. Name the license in the reason:

```toml
[[licenses.allowed_package]]
name = "colorama"
version = "0.4.6"
reason = "BSD. Installed metadata reports the reviewed BSD license in its short form."
```

`version` takes an exact version, a semver range such as `^1.2.0`, or `*`. `name` takes a glob for a package built for
each platform:

```toml
[[licenses.allowed_package]]
name = "@img/sharp-libvips-*"
version = "*"
reason = "LGPL-3.0-or-later. sharp loads the library as a separate file."
```

gspot reports a record that matches no package of the lockfile. A package that the lockfile records for another
platform still counts as a match.
Python package names match as pip matches them: letter case and runs of `.`, `_`, and `-` do not matter.
When init replaces `.license-checker.json`, move packages you still allow into `[[licenses.allowed_package]]` records,
with exact versions.

## Vulnerabilities

`dependencies/osv-scanner` reads your lockfiles and reports known vulnerable packages at push. Update the package,
then check again. An accepted advisory needs an [ignore with a reason](/use/ignore/).

## Lockfiles and package managers

These checks read the project files at push, without the network:

| Check                              | Reports                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dependencies/stale-lockfile`      | A `package.json` whose dependencies differ from what its npm, pnpm, or Bun lockfile records.   |
| `dependencies/react-versions`      | A project that locks `react` and `react-dom` at two versions.                                  |
| `dependencies/package-manager-pin` | A `packageManager` field that names another version than the mise pin of that package manager. |

For a stale lockfile, run the install of your package manager, such as `bun install`, and commit the lockfile.

## Registry hosts

Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com` by default.
Add another reviewed host with `gspot set dependencies.allowed_registries <HOST> --reason "<WHY>"`.
Downloads must still use HTTPS. A host allowed in a scope counts for that folder and the folders inside it.

## Release age of the gspot tools

gspot installs its own tools in `.gspot/` and holds back each release for `dependencies.min_release_age_days` days, 7
by default. It leaves the install settings of your project alone: to hold back your own dependencies, set the release
age option of your package manager. To make gspot wait 14 days:

```shell
gspot set dependencies.min_release_age_days 14
```

Use `gspot explain dependencies.min_release_age_days` to inspect its default and when a change needs a reason.
See the [dependencies reference](/reference/configurations/dependencies/) for every check.
