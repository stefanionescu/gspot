---
title: Dependencies and Licenses
description: Check vulnerable packages, dependency licenses, and registry hosts.
configurations: [dependencies, licenses]
---

Check dependencies for known vulnerabilities and review the licenses and registry hosts your repository accepts.

## Licenses

`gspot add licenses` adds the general `licenses` configuration. At the push stage, it reads the license of every locked
package through osv-scanner, which asks the deps.dev service, so the check needs the network and a lockfile.

gspot picks no allowed licenses for you, and scans none until you set `licenses.allowed` or an allowed package. After
you review the licenses that your project accepts, list them:

```shell
gspot set licenses.allowed MIT Apache-2.0 BSD-3-Clause
gspot check --only licenses/allowed
```

The check reads the lockfiles of each scope, such as `uv.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and
`bun.lock`. Without a lockfile, it stops with a note.

## Allow a license or one package

Add a license to `licenses.allowed` to allow every package under it. To allow one package version with a license you
reviewed, add a `[[licenses.allowed_package]]` record. Name the license in the reason:

```toml
[[licenses.allowed_package]]
name = "colorama"
version = "0.4.6"
reason = "BSD. Installed metadata reports the reviewed BSD license in its short form."
```

`version` takes an exact version, a version range such as `^1.2.0`, or `*`. `name` takes a glob for a package built for
each platform:

```toml
[[licenses.allowed_package]]
name = "@img/sharp-libvips-*"
version = "*"
reason = "LGPL-3.0-or-later. sharp loads the library as a separate file."
```

gspot reports a record that matches no package of the lockfile. A package that the lockfile records for another platform
still counts as a match. Python package names match as pip matches them: letter case and runs of `.`, `_`, and `-` do
not matter.

## Vulnerabilities

`dependencies/osv-scanner` reads your lockfiles and reports known vulnerable packages at push. The GitHub workflow that
gspot writes also runs it every Monday at 06:00 UTC over every lockfile, because a new advisory can name a version that
no commit changed. Update the package, then check again. An accepted advisory needs an
[ignore with a reason](/use/ignore/).

The check skips `.gspot/`, because you cannot change the versions that gspot pins for its tools.

## Lockfiles and package managers

These checks read the project files, without the network:

| Check                              | Stage             | Reports                                                                                                                             |
| ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dependencies/stale-lockfile`      | commit            | A `package.json` whose dependencies differ from what its npm, pnpm, or Bun lockfile records.                                        |
| `dependencies/package-manager-pin` | commit            | A `packageManager` field that names another version than the mise pin of that package manager.                                      |
| `dependencies/lockfiles`           | commit            | Lockfile downloads that do not use HTTPS or an allowed registry host, and a scope that holds the lockfiles of two package managers. |
| `dependencies/syncpack`            | push, level `all` | A dependency that two workspace packages resolve to different versions.                                                             |

For a stale lockfile, run the install of your package manager, such as `bun install`, and commit the lockfile.

## Registry hosts

Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com` by default. Add another reviewed host with `gspot
set dependencies.allowed_registries <HOST> --reason "<WHY>"`. Downloads must still use HTTPS. A host allowed in a scope
counts for that folder and the folders inside it.

## Release age of the gspot tools

gspot installs its own tools in `.gspot/`. Each package that it installs there waits `dependencies.min_release_age_days`
days after its release, 7 by default. The hold covers the tools that gspot pins and the packages that they pull in. Only
the gspot packages install at the version of the CLI.

When a pinned tool came out less than that many days ago, `gspot install` stops and names the tool and the setting.
Wait for the release to age, or lower the setting. Bun does not hold back a package that a project pins to one version,
so with Bun the pinned tools install at once.

gspot leaves the install settings of your project alone: to hold back your own dependencies, set the release age option
of your package manager. To make gspot wait 14 days:

```shell
gspot set dependencies.min_release_age_days 14
```

Use `gspot explain dependencies.min_release_age_days` to inspect its default and when a change needs a reason. See the
[dependencies reference](/reference/configurations/dependencies/) for every check.
