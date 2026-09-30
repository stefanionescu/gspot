---
title: Dependency licenses
description: Check the licenses of your installed packages, and allow one package version by exception.
---

The `licenses` kit checks the license of every installed npm and Python package at the push
stage. Install your project dependencies first. Python projects use the `.venv` of their scope,
and `gspot install` installs the license scanner.

## Allow a license or one package

Add a license to `tools.licenses.licenses_allowed` to allow every package under it. To allow
one package version with a license you reviewed, add an exception:

```toml
[[tools.licenses.packages_allowed]]
package = "colorama@0.4.6"
license = "BSD"
reason = "Installed metadata reports the reviewed BSD license in its short form."
```

An exception holds only while the package reports that license. When it reports another one,
the exception stops working, even when the new license is allowed.

`gspot set` writes these settings and applies them. After you edit `gspot.toml` by hand, run
`gspot apply`. gspot writes the result to `.gspot/config/licenses.json`, or to
`.gspot/config/<scope>/licenses.json` for a scope. The check refuses to run when that file is
missing or out of date.

## Results

- `0`: every package has an allowed license or a valid exception.
- `1`: a package has a license that is not allowed.
- `2`: the environment is missing, the scan found nothing, or the scanner failed.

Python package names match the way pip matches them: letter case and runs of `.`, `_`, and `-`
do not matter. Versions and licenses must match exactly.

## Exceptions and the lockfile

Selecting `licenses` also turns on `integrity/allowlists-match` at the commit stage. It checks
that each exception names a version that the lockfile of the project or workspace holds. A
kit that selects the same check does not run it twice.

When init replaces an existing license configuration file, move the exceptions you still need
into `tools.licenses.packages_allowed`, with exact versions.
