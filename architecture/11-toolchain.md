# Toolchain

This document decides how gspot itself is installed and pinned, and how the tools gspot runs are
pinned, installed, verified, and upgraded. gspot pins, the package managers install, and
`doctor` verifies.

## Installing gspot

gspot is one binary for each platform. It is published to GitHub Releases, and to npm as a
launcher package over one package for each platform (D-52). Three ways to get it:

| Way                  | Command                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| mise                 | `mise use -g github:stefanionescu/gspot` for a global copy                                      |
| npm, pnpm, yarn, bun | `npx gspot init` or `bunx gspot init`; the `gspot` package is a launcher with no install script |
| release asset        | download `gspot-<os>-<arch>` from the release page and put it on `PATH`                         |

A `curl | sh` installer is never offered, because the rule files ban the pattern.

A global install exists to run `gspot init` in a repository that has nothing yet. After `init`,
the repository pins its own version in two places. `.gspot/version` is one tracked line that
every command reads. The runner holds the second: the mise file of gspot, or the `gspot` line of
`devDependencies` (D-147). The hook and the tasks find that pinned version, so two people on one
repository run the same gspot.

A binary of another version than `.gspot/version` exits 2 on every command that reads the
config. It prints the two ways forward: install the pinned version, or move the pin with
`gspot upgrade --to <this version>`. `init`, `doctor`, `explain`, `list`, `--version`, and
`--help` run under any version. A newer gspot is announced by `upgrade --dry-run` and nowhere
else.

## Where gspot is published

All three places carry the same version from one release run:

| Place          | Holds                                                                                    | Used by                                                |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| GitHub release | the seven binaries and `checksums.txt`, each binary attested                             | mise, and the CI job without mise                      |
| npm            | `gspot`, one `@gspot/cli-<os>-<cpu>` package for each target, and `@gspot/eslint-plugin` | `npx gspot`, and `.gspot/package.json`                 |
| `gspot.dev`    | the manual and `gspot.schema.json`                                                       | the `#:schema` line of every `gspot.toml`, and editors |

The seven targets include `linux-x64-musl` and `linux-arm64-musl`, for Alpine images. Every
published package ships `LICENSE.md` and `NOTICE.md`. The release fails before it
publishes anything when one binary or one grammar is absent.

Before the first release, a repository installs from the local `verdaccio` registry of the test
harness, which `GSPOT_REGISTRY` names (D-158). The redo of yap-swift-app runs that way, and no
tracked file holds the address.

The first release needs these, in this order:

1. The npm organization `gspot` and the package name `gspot`, owned by this project.
2. A public repository.
3. Trusted publishing set up for each package.
4. The domain that serves the manual.
5. Every row of [18-gaps.md](18-gaps.md) closed, and the Windows job green.

## Pins

Every preset lists its tools with one version and the name under each installer. An installer
that numbers differently carries its own version:

```toml
[[tools]]
name            = "shellcheck"
version         = "0.11.0"
mise            = "shellcheck"
github          = "koalaman/shellcheck"
version_command = ["shellcheck", "--version"]

[[tools]]
name    = "taplo"
version = "0.10.0"
mise    = "taplo"
npm     = { name = "@taplo/cli", version = "0.7.0" }

[[tools]]
name    = "eslint-plugin-regexp"
kind    = "library"
version = "3.3.0"
npm     = "eslint-plugin-regexp"

[[tools]]
name     = "xcodebuild"
provider = "host"                   # present or the check fails; gspot cannot install it
```

One gspot version pins one version of every managed tool. Locked dependencies and the package-manager version are
also inputs to the installation. Host tools and the project's TypeScript retain their own
versions; reports name them instead of promising byte-identical environments. ESLint is pinned at the newest major that every shipped plugin supports (D-142).
A release test asks each registry for every pin, reads the ESLint range of every plugin, and
fails a pin below what a reference repository runs.

## How tools arrive

| Kind of tool                      | Where it installs                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| a binary mise can install         | `.mise/conf.d/gspot-tools.toml`, under the mise runner                                        |
| an npm tool or library            | `.gspot/node_modules`, from `.gspot/package.json`, with the package manager of the repository |
| a Python tool                     | `.gspot/.venv`, from `.gspot/pyproject.toml`, with uv (D-157)                                 |
| a host tool, such as `xcodebuild` | nowhere; `doctor` reports whether it is present                                               |
| any tool, with no mise            | nowhere; `doctor` prints the install command of the platform                                  |
| a repository with no JavaScript   | the npm tools install with bun or npm, whichever the machine has, bun first (D-171)           |

`gspot apply` resolves and writes tool lockfiles. `gspot install` installs their recorded contents
without changing tracked files (D-156). A missing or conflicted lockfile requires `apply` first.
No package lifecycle script or setup task runs gspot automatically.

The lint tools of gspot are tools, not
dependencies of the repository (D-145). gspot never writes
one into `package.json`, and the ESLint of the developer, its config, and its plugins stay as
they are. The generated ESLint config sits in `.gspot/`, so its imports resolve there. The type
check keeps the TypeScript of the repository, because `tsc` answers for the build the developer
ships.

The install under `.gspot/` takes the registry, the proxy, and the token of the repository from
the package manager. It stays a project of its own inside a pnpm or Yarn workspace. An install
hint names Homebrew only for a tool with no pin, because Homebrew installs the
current version alone.

Every tool in the presets has a Windows build except `plutil`, `xcodebuild`, `xcstringstool`,
`swiftlint`, `swiftformat`, and `periphery`. Their checks are platform skips elsewhere.

## One tool per job

A tool enters a preset only when it does something no tool already in the set does. Applied to
the reference set, these were cut, and every rule they enforced is re-pointed in the ledger:

| Cut                                     | Kept instead                                             | Why                                                               |
| --------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| lizard                                  | sonarjs `cognitive-complexity`                           | sonarjs runs on every JavaScript file ESLint sees, in the editor  |
| madge                                   | `import-x/no-cycle`                                      | same graph, CommonJS included                                     |
| type-coverage                           | `tsc` strict, `no-explicit-any`, the `no-unsafe-*` rules | it measured what the rules already forbid                         |
| sort-package-json                       | `eslint-plugin-package-json`                             | orders, validates, and fixes in one tool                          |
| pip-audit                               | osv-scanner                                              | one advisory database over every lockfile, `uv.lock` included     |
| bandit, the vendored bandit Semgrep set | Ruff `S` plus the Semgrep Python pack                    | Ruff `S` is the bandit port and runs in the editor                |
| interrogate                             | Ruff `D100` to `D107`                                    | same rule                                                         |
| pyright                                 | basedpyright                                             | stricter `all` mode; a native binary with no Node dependency      |
| bearer                                  | Semgrep                                                  | one rule format for the repository's own rules and the OWASP pack |
| gspot's own Markdown link checker       | lychee `--offline --include-fragments`                   | lychee checks anchors                                             |
| gspot's own version alignment           | syncpack version groups                                  | syncpack expresses pairs and ranges                               |
| trivy over lockfiles                    | osv-scanner for lockfiles; trivy for images and IaC      | one scanner per surface                                           |

Kept with a stated reason, where overlap looked possible:

- gitleaks and trufflehog (pattern detection against live verification);
- lychee and linkinator (documents against a served site);
- actionlint and zizmor (syntax against security);
- editorconfig-checker (covers files no formatter touches);
- pydoclint (until Ruff `DOC` leaves preview);
- vulture (basedpyright reports unused private symbols only).

## Verification

`gspot doctor` finds every tool the selection needs, in this order: `.gspot/node_modules/.bin`,
the `.venv/bin` of the scope, the active `PATH`, and then mise shims. Paths activated by
mise are part of `PATH`; a global shim must not replace that active toolchain. It never reads
the `node_modules` of the repository for a lint tool. It runs the version command the
manifest names and compares:

| State    | Meaning                                                 | Effect on `check`                                    |
| -------- | ------------------------------------------------------- | ---------------------------------------------------- |
| ok       | present at the pinned version, or at or above the floor | runs                                                 |
| outdated | present below the floor                                 | fails the checks that need it                        |
| newer    | present above the pin                                   | runs, and `doctor` notes it                          |
| missing  | not found                                               | fails the checks that need it, with the install hint |

`check` runs the same probe for the tools its checks need, once for a run.

## Upgrade

`gspot upgrade --dry-run` compares what is on disk with what this binary writes and pins:

```text
gspot 0.4.0 -> 0.5.0

rules
  + @typescript-eslint/no-unnecessary-condition   typescript/eslint
  + closure_body_length                           swift/swiftlint
  - gspot/no-imports-after-statements             typescript/eslint

tools
  ~ eslint  9.38.0 -> 9.41.2
  + ast-grep  0.45.3  new, needed by structure

generated configuration
  ~ .gspot/eslint.config.mjs  14 lines changed
  + .gspot/taplo.toml  new

rule files
  ~ .gspot/rules/general/agent/WORKING.md  12 lines changed

presets available, not selected
  vitest  vitest in package.json          gspot add vitest

action on upgrade
  migrate config, write generated files and locks, move the pin to 0.5.0, install tools
```

The rules section compares the rule lists of two configs as data, for every tool whose config
lists rules. `gspot upgrade` migrates old TOML before target-schema validation, writes config, generated outputs and locks with recovery, updates the pin last, then installs tools. It runs no check and never commits (D-159, D-165). [02-cli.md](02-cli.md) owns the sequence, dry-run and interruption behavior.

## Rollback

`gspot upgrade --to 0.4.0` requires a supported reverse migration. Otherwise, restore the previous config, generated files, lockfiles, and version pin together from the upgrade commit or recovery; run the matching older binary and `gspot install`. A rollback never silently discards settings unknown to the older schema.

## Network

`upgrade` reaches the network to find a newer gspot and to read it. The install of tools reaches
the registries. `apply` may reach registries to resolve changed tool locks and downloads Vale packages at `all`. Immutable `install` only installs recorded dependency contents; it never regenerates locks. `check` and the
hooks never reach the network, except for a check that declares `network`, which sits at `push`
or `manual`.
