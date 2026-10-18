---
title: Dependencies and licenses
description: Check vulnerable packages, dependency licenses, registry hosts, and release age.
---

Check dependencies for known vulnerabilities and review the licenses, registry hosts, and release ages your repository accepts.

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

## Allow a license or one package

Add a license to `licenses.allowed` to allow every package under it. To allow
one package version with a license you reviewed, add a `[[licenses.allowed_package]]` record. Name the license in the reason:

```toml
[[licenses.allowed_package]]
name = "colorama"
version = "0.4.6"
reason = "BSD. Installed metadata reports the reviewed BSD license in its short form."
```

An allowed package holds only for that exact installed version. gspot reports a record that matches no installed package.
Python package names match as pip matches them: letter case and runs of `.`, `_`, and `-` do not matter.
When init replaces `.license-checker.json`, move packages you still allow into `[[licenses.allowed_package]]` records,
with exact versions.

## Vulnerabilities

`dependencies/osv-scanner` reads your lockfiles and reports known vulnerable packages at push. Update the package,
then check again. An accepted advisory needs an [ignore with a reason](/use/ignore/).

## Registry hosts

Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com` by default.
Add another reviewed host with `gspot set dependencies.allowed_registries <HOST> --reason "<WHY>"`.
Downloads must still use HTTPS. A host allowed in a scope counts for that folder and the folders inside it.

## Release age

A new release waits `dependencies.min_release_age_days` days, 7 by default, before an install can pick it up. gspot
writes this hold into the file of each installer that a folder uses:

| Installer           | File                  | Key and unit                     |
| ------------------- | --------------------- | -------------------------------- |
| Bun 1.3 or newer    | `bunfig.toml`         | `minimumReleaseAge`, seconds     |
| npm 11.17 or newer  | `.npmrc`              | `min-release-age`, days          |
| pnpm 10.16 or newer | `pnpm-workspace.yaml` | `minimumReleaseAge`, minutes     |
| Yarn 4.10 or newer  | `.yarnrc.yml`         | `npmMinimalAgeGate`, minutes     |
| uv 0.9.17 or newer  | `pyproject.toml`      | `[tool.uv] exclude-newer`        |
| mise                | `mise.toml`           | `[settings] minimum_release_age` |

- A longer hold that a file already has stays.
- `@gspothq/cli` and `@gspothq/eslint-plugin` go on each exclude list, so a gspot upgrade installs the day it comes
  out. Your own excludes stay.
- gspot installs its own tools in `.gspot/` with the same hold.
- mise holds back version requests such as `latest`. A version you pin exactly installs at once.
- Yarn 1 has no hold. `dependencies/release-age` reports a `packageManager` version too old to hold releases back.

To require 14 days:

```shell
gspot set dependencies.min_release_age_days 14
```

Use `gspot explain dependencies.min_release_age_days` to inspect its default and when a change needs a reason.
See the [dependencies reference](/reference/configurations/dependencies/) for every check.
