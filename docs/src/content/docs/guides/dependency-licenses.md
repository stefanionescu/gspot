---
title: Check dependency licenses
description: Check installed dependency licenses and record exact package exceptions.
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

Select `licenses` to check installed npm and Python packages with `licenses/packages` at push.
Install the project dependencies first. Python projects use their scope's `.venv`; the license
scanner is installed separately by `gspot install`.

`gspot apply` writes the effective allowances and exceptions to `.gspot/licenses.json`.
Scoped policies have their own files under `.gspot/<scope>/licenses.json`. Change these values
with `gspot set`, which applies the setting. After a manual edit of `gspot.toml`, run `gspot apply`.
The scanner reads this generated configuration and refuses missing or stale values before
scanning dependencies.

Add a license to `tools.licenses.licenses_allowed`, or record an exception for one package
version and its reported license:

```toml
[[tools.licenses.packages_allowed]]
package = "colorama@0.4.6"
license = "BSD"
reason = "Installed metadata reports the reviewed BSD license in its short form."
```

An exception stops passing if the package reports a different license, even when that license
is otherwise allowed. A disallowed license returns exit code `1`. A missing environment,
empty scan, or scanner failure returns `2`.

Python package names use the same
[normalization](https://packaging.python.org/en/latest/specifications/name-normalization/)
for installed packages, exceptions, and lockfiles. Letter case and runs of `.`, `_`, and `-`
do not distinguish Python distribution names. Versions and reported licenses remain exact.

Selecting `licenses` also selects `integrity/allowlists-match` at commit. This shared check
verifies that each package exception names a version in the project or workspace lockfile.
It runs once even when another selected preset includes it. It does not select the other
checks or tools from `structure`.

Adoption keeps nested license configuration in its directory scope. It retains original
configuration when an `onlyAllow` list excludes shipped allowances, or when overlapping
configuration requires explicit conversion. Package exclusions need installed dependencies
so adoption can record their exact versions and reported licenses.
