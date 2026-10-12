---
title: Dependency licenses
description: Check the licenses of your installed packages, and allow one package version.
---

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
