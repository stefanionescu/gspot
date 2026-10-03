---
title: Dependency licenses
description: Check the licenses of your installed packages, and allow one package version by exception.
---

The `licenses` kit checks the license of every installed npm and Python package at the push
stage. Install your project dependencies first. Python projects use the `.venv` of their scope,
and `gspot install` installs the license scanner.

## Allow a license or one package

Add a license to `tools.licenses.allowed` to allow every package under it. To allow
one package version with a license you reviewed, add an exception:

```toml
[[tools.licenses.exceptions]]
package = "colorama@0.4.6"
license = "BSD"
reason = "Installed metadata reports the reviewed BSD license in its short form."
```

An exception holds only while the package reports that license, and its version must be one the
lockfile holds. Python package names match the way pip matches them: letter case and runs of `.`,
`_`, and `-` do not matter. Versions and licenses must match exactly.

When init replaces an existing license configuration file, move the exceptions you still need
into `tools.licenses.exceptions`, with exact versions.
