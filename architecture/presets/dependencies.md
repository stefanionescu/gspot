# `dependencies`

Kind: concern. Selected by default. Dependency health: advisories, unused, duplicated,
skewed, foreign lockfiles, ownership, install policy.

## Claims

Every manifest and lockfile: `package.json`, `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`,
`yarn.lock`, `bunfig.toml`, `.npmrc`, `pnpm-workspace.yaml`, `pyproject.toml`, `uv.lock`,
`requirements*.txt`, `Package.swift`, `Package.resolved`, `Cargo.toml`, `Cargo.lock`, `go.mod`,
`go.sum`, `Gemfile.lock`.

## Tools

osv-scanner, knip, deptry, syncpack, eslint-plugin-package-json, lockfile-lint.

## Generated configuration

| Target                                 | Holds                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/osv-scanner.toml`              | `[[IgnoredVulns]]` from `[tools.osv] ignore` with id, reason, and a date to re-review                                                                                                                                           |
| `.gspot/syncpack.json`                 | one exact version per dependency across the workspace; a version group per aligned pair from `[tools.dependencies] aligned` (defaults: `next` with `eslint-config-next`, `react` with `react-dom`, `@types/react` with `react`) |
| the package manager's install settings | `bunfig.toml` `[install] minimumReleaseAge`, `[install.security] scanner`; `.npmrc` `min-release-age`; `pnpm-workspace.yaml` `minimumReleaseAge`; written as managed entries after a yes at init                                |

## Checks

| Id                                 | Stage                                                              | Command                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dependencies/osv`                 | push, network                                                      | `osv-scanner --config .gspot/osv-scanner.toml --lockfile <each>`; Python advisories come from `uv.lock` here                                                                                                                                                                                                                               |
| `dependencies/syncpack`            | push                                                               | `syncpack lint --config .gspot/syncpack.json`                                                                                                                                                                                                                                                                                              |
| `dependencies/lockfile-lint`       | commit                                                             | registries over HTTPS, allowed hosts only                                                                                                                                                                                                                                                                                                  |
| `integrity/lockfile-fresh`         | commit when a manifest or lockfile is staged; push                 | `bun install --frozen-lockfile --dry-run` (or npm, pnpm, yarn equivalents), `uv lock --check`                                                                                                                                                                                                                                              |
| `integrity/manifest-policy`        | commit                                                             | exact versions (no `^`, `~`, ranges); keys ordered by `package-json/order-properties`; one `packageManager`, equal across workspace packages; root packages private; no foreign lockfiles; `engines` agree with `.nvmrc`, `.node-version` and the mise pin; scripts policy from `[tools.package-json] scripts` (`any`, `wrappers`, `none`) |
| `integrity/install-policy`         | commit when a manifest, lockfile or install config is staged; push | minimum release age at or above `[tools.install] min_release_age_days`; the security scanner declared where the manager supports one; the installed tree equals the lockfile version for version; every peer dependency satisfied                                                                                                          |
| `integrity/dependency-ownership`   | commit                                                             | Python: `pyproject.toml` owns every dependency; no `requirements*.txt` unless a `[[declare]]` names it with `produced_by` (`uv export ...`), in which case `integrity/generated-fresh` checks it; no `pip install` outside `[tools.dependencies] pip_install_allowed`                                                                      |
| `integrity/large-files`            | commit                                                             | a tracked file over `[limits] file_size_kb` (default 1024) is under LFS or declared                                                                                                                                                                                                                                                        |
| `typescript/knip`, `python/deptry` | push                                                               | unused dependencies and exports                                                                                                                                                                                                                                                                                                            |
| `dependencies/swift`               | push                                                               | `Package.resolved` is present and matches `Package.swift`; osv-scanner has no Swift extractor and `doctor` says so                                                                                                                                                                                                                         |

The exact-version rule belongs to `package.json` and its workspace packages only. Python dependencies keep their ranges in `pyproject.toml`. A Python package installed into someone else's environment (a plugin, a ComfyUI custom node, a library) must declare ranges. The pins live in `uv.lock`, and `integrity/lockfile-fresh` is the check that they hold.

## Settings

`tools.osv.ignore` (id, reason, review_by), `tools.dependencies.aligned` (pairs), `tools.dependencies.pip_install_allowed`
(paths), `tools.package-json.scripts`, `tools.package-json.allowed_scripts`, `tools.package-json.indent`,
`tools.install.min_release_age_days` (default 7), `tools.install.security_scanner`,
`tools.lockfile-lint.hosts`, `limits.file_size_kb`.

## Rule files

`general/code/DEPENDENCIES.md`.
