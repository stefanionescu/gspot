# `licenses`

Kind: concern. Selected by default when a manifest exists.

## Claims

The installed dependency tree per ecosystem.

## Tools

license-checker-rseidelsohn (npm), pip-licenses (Python).

## Generated configuration

`.gspot/licenses.json`: the allowlist and exact-version exceptions.

Shipped allowlist: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `Unlicense`, `BlueOak-1.0.0`, `Python-2.0`.

## Checks

| Id                           | Stage  | Command                                                                                                                                                                                                                 |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `licenses/npm`               | push   | `license-checker-rseidelsohn --json --excludePrivatePackages --start <scope>` per workspace package; gspot compares every reported license against the allowlist and the exceptions; zero packages scanned is a failure |
| `integrity/allowlists-match` | commit | every exception names `name@exact.version` that the lockfile holds                                                                                                                                                      |

An exception passes only when the package reports the license the exception names. A package whose
reported license differs from its exception fails with both licenses in the message, so a license
change at the same version is never accepted silently.

## Settings

`tools.licenses.allow` (add carries no reason; remove does), `tools.licenses.exceptions`
(`name@version`, `license`, reason); `gspot allow licenses colorama@0.4.6 --license BSD --reason`
writes an exception.

```toml
[tools.licenses]
allow = ["MPL-2.0"]

[[tools.licenses.exceptions]]
package = "colorama@0.4.6"
license = "BSD"
reason  = "Installed metadata reports the permissive BSD license in its short form."
```

## Rule files

None.
