---
title: Dependencies and licenses
description: Check vulnerable packages, dependency licenses, and registry hosts.
configurations: [dependencies, licenses]
---

gspot checks your dependencies for known vulnerabilities. It can also check their licenses, and the registry hosts that
your lockfiles download from.

## Licenses

`gspot add licenses` turns on the `licenses` configuration. Its check runs before each push. It reads the license of
every package in your lockfiles through osv-scanner, which asks the deps.dev service, so the check needs the network
and a lockfile.

gspot does not choose the allowed licenses for you. The check scans nothing until you set `licenses.allowed` or add an
allowed package. Decide which licenses your project accepts, then list them:

```shell
gspot set licenses.allowed MIT Apache-2.0 BSD-3-Clause
gspot check --only licenses/allowed
```

The check reads the lockfiles of each scope, such as `uv.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and
`bun.lock`. Without a lockfile, it stops with a note.

## Allow a license or one package

To allow every package under a license, add the license to `licenses.allowed`. To allow one package version whose
license you reviewed, add a `[[licenses.allowed_package]]` record, and name the license in the reason:

```toml
[[licenses.allowed_package]]
name = "colorama"
version = "0.4.6"
reason = "BSD. Installed metadata reports the reviewed BSD license in its short form."
```

`version` takes an exact version, a version range such as `^1.2.0`, or `*` for any version. For a package with one
build for each platform, `name` takes a glob pattern:

```toml
[[licenses.allowed_package]]
name = "@img/sharp-libvips-*"
version = "*"
reason = "LGPL-3.0-or-later. sharp loads the library as a separate file."
```

gspot reports a record that matches no package in the lockfile. A package that the lockfile lists for another platform
still counts as a match. Python package names match the way pip matches them: letter case and runs of `.`, `_`, and
`-` do not matter.

## Vulnerabilities

Before each push, `dependencies/osv-scanner` reads your lockfiles and reports each package with a known vulnerability.
Each run sends the names and versions of the locked packages to the Open Source Vulnerabilities (OSV) service. To fix a
finding, update the package, then check again. To keep a package that has an advisory,
[ignore the advisory](/use/ignore/#ignore-a-dependency-advisory) with a reason.

The check skips `.gspot/`, because you cannot change the versions that gspot pins for its tools. A new gspot release
fixes an advisory in those tools by pinning new versions.

A new advisory can name a version that is already locked, and then no commit runs the check. gspot adds no scheduled
job to your CI. To scan on a schedule, add a workflow of your own next to `.github/workflows/gspot.yml`. Copy its steps
up to and including `Install gspot tools`, set `on.schedule`, and end with this step, which reads every lockfile:

```yaml
- run: gspot check --only dependencies/osv-scanner
```

## Lockfiles and package managers

These checks read the project files and do not use the network:

| Check                              | Stage             | Reports                                                                                                                             |
| ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dependencies/stale-lockfile`      | commit            | A `package.json` whose dependencies differ from what its npm, pnpm, or Bun lockfile records.                                        |
| `dependencies/package-manager-pin` | commit            | A `packageManager` field that names a different version from the one that mise pins for that package manager.                       |
| `dependencies/lockfiles`           | commit            | Lockfile downloads that do not use HTTPS or an allowed registry host, and a scope that holds the lockfiles of two package managers. |
| `dependencies/syncpack`            | push, level `all` | A dependency that two workspace packages resolve to different versions.                                                             |

When a lockfile is out of date, run the install command of your package manager, such as `bun install`, and commit the
lockfile.

## Registry hosts

By default, lockfile downloads may come from `registry.npmjs.org` and `registry.yarnpkg.com`. To allow another host,
list every host, because `gspot set` replaces the whole list:

```shell
gspot set dependencies.allowed_registries registry.npmjs.org registry.yarnpkg.com npm.example.com --reason "<why>"
```

Downloads must still use HTTPS. A host allowed in a scope counts for that folder and the folders inside it.

## Release age of the gspot tools

gspot installs its own tools in `.gspot/`. It installs a package there only after the package has been out for
`dependencies.min_release_age_days` days, 7 by default. This wait covers the tools that gspot pins and the packages that
they depend on. Only the gspot packages skip the wait, and install at the version of the CLI.

When a pinned tool came out fewer days ago, `gspot install` stops and names the tool and the setting. Wait until the
release is old enough, or lower the setting. Bun does not apply the wait to a package that a project pins to one
version, so with Bun the pinned tools install at once.

gspot does not change the install settings of your project. To make your own dependencies wait, set the release age
option of your package manager. To make gspot wait 14 days for its tools:

```shell
gspot set dependencies.min_release_age_days 14
```

To see the default of the setting, and which changes need a reason, run
`gspot explain dependencies.min_release_age_days`. The [dependencies reference](/reference/configurations/dependencies/)
lists every check.
