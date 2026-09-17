# licenses

Kind: repository. Selected by default when a manifest exists.

## Claims

The installed dependency tree per ecosystem.

## Tools

license-checker-rseidelsohn (npm), pip-licenses (Python).

## Generated configuration

`.gspot/licenses.json`: the allowlist and exact-version exceptions.

Shipped allowlist: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, CC-BY-3.0,
CC-BY-4.0, Unlicense, BlueOak-1.0.0, Python-2.0.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `licenses/npm` | push | `license-checker-rseidelsohn --onlyAllow <list> --excludePackages <exact versions> --excludePrivatePackages --start <scope>` per workspace package; zero packages scanned is a failure |
| `licenses/pip` | push | `pip-licenses --allow-only <list> --ignore-packages <exact versions>` |
| `integrity/allowlists-resolve` | commit | every exception names `name@exact.version` |

## Settings

`tools.licenses.allow` (add carries no reason; remove does), `tools.licenses.exceptions`
(`name@version`, reason).

## Rule files

None.
