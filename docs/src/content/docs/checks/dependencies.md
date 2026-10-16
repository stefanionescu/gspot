---
title: Dependencies and licenses
description: Check vulnerable packages, dependency licenses, registry hosts, and release age.
---

Check dependencies for known vulnerabilities and review the licenses, registry hosts, and release ages your repository accepts.

## Licenses

An npm `package.json` or Python `pyproject.toml` selects the general `licenses` configuration automatically. It checks the license of every installed npm and Python package at the push
stage. Install your project dependencies first. Python projects use the `.venv` of their scope,
and `gspot install` installs the license scanner.

gspot does not choose allowed licenses for you. Until you set `licenses.allowed` or an allowed package, gspot does not scan licenses. For example, after reviewing the licenses your project accepts:

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
Replace the placeholders with the host and your reason. Downloads must still use HTTPS. A host allowed in a scope applies to that folder and the folders inside it.

## Release age

`dependencies.min_release_age_days` sets the minimum age for npm releases. gspot writes the setting for supported
package managers. To require seven days:

```shell
gspot set dependencies.min_release_age_days 7
gspot install
```

Use `gspot explain dependencies.min_release_age_days` to inspect its default and when a change needs a reason.
See the [dependencies reference](/reference/configurations/dependencies/) for every check.
