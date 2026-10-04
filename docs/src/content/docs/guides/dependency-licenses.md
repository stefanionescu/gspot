---
title: Dependency licenses
description: Check the licenses of your installed packages, and allow one package version by exception.
---

The `licenses` configuration checks the license of every installed npm and Python package at the push
stage. Install your project dependencies first. Python projects use the `.venv` of their scope,
and `gspot install` installs the license scanner.

New repositories choose their license policy explicitly. Until `licenses.allowed` is set, `licenses/packages` is skipped. For example, after reviewing the licenses your project accepts:

```shell
gspot add licenses
gspot set licenses.allowed MIT Apache-2.0 BSD-3-Clause
gspot install
gspot check --only licenses/packages
```

## Allow a license or one package

Add a license to `licenses.allowed` to allow every package under it. To allow
one package version with a license you reviewed, add an exception:

```toml
[[licenses.exceptions]]
package = "colorama@0.4.6"
license = "BSD"
reason = "Installed metadata reports the reviewed BSD license in its short form."
```

An exception holds only while the package reports that license, and its version must be one the
lockfile holds. Python package names match the way pip matches them: letter case and runs of `.`,
`_`, and `-` do not matter. Versions and licenses must match exactly.

When init replaces `.license-checker.json`, move the exceptions you still need
into `licenses.exceptions`, with exact versions.
