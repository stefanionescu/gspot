# Toolchain

This document decides how gspot itself is installed and pinned, and how the tools gspot runs are
pinned, installed, verified, and upgraded. gspot pins, the package managers install, and
`doctor` verifies.

## Installing gspot

gspot is one npm package, `@gspothq/cli`, whose command is `gspot`. It is written in TypeScript and bundled to plain
JavaScript. It runs on Node.js 22 or newer and on Bun, on every system those run on. It has no per-system
builds and no install script. Three ways to get it:

| Way                  | Command                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| npm, pnpm, yarn, bun | `npm install --save-dev @gspothq/cli`, then `npx gspot init`; or `bunx gspot init` |
| global npm           | `npm install --global @gspothq/cli`, for a repository without `package.json`       |
| mise                 | `mise use -g npm:@gspothq/cli` for a global copy                                   |

A `curl | sh` installer is never offered, because the rule files ban the pattern.

A global install exists to run `gspot init` in a repository that has nothing yet. After `init`,
the repository pins its own version in two places. `.gspot/version` is one tracked line that
every command reads. The runner holds the second: the mise file of gspot, or the `gspot` line of
`devDependencies`. The hook and the tasks find that pinned version, so two people on one
repository run the same gspot.

A gspot of another version than `.gspot/version` exits 2 on every command that reads the
config. It prints the two ways forward: install the pinned version, or move the pin with
`gspot apply`. `init`, `doctor`, `explain`, `list`, `--version`, and
`--help` run under any version. Package managers update gspot itself.

## Where gspot is published

Both places carry the same version from one release run:

| Place       | Holds                                       | Used by                                                |
| ----------- | ------------------------------------------- | ------------------------------------------------------ |
| npm         | `@gspothq/cli` and `@gspothq/eslint-plugin` | `npx gspot`, mise, CI, and `.gspot/package.json`       |
| `gspot.dev` | the manual and `gspot.schema.json`          | the `#:schema` line of every `gspot.toml`, and editors |

The `@gspothq/cli` package holds the bundle in `dist/`, the kits, the guides, and the grammar files
with their licenses. The GitHub release carries notes only.

The first release needs these, in this order:

1. The npm org `gspothq` for `@gspothq/cli` and `@gspothq/eslint-plugin`, a first version of each
   published by hand, and `release.yml` added to each as its trusted publisher. The release job
   then publishes through OpenID Connect, with no stored token. The `@gspot` scope belongs to
   another npm account.
2. A public repository.
3. The domain that serves the manual.
4. The Windows job green.

## Pins

Every kit lists its tools with one version and the name under each installer. An installer
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

[[tools]]
name      = "codeql"
platforms = ["macos", "linux-x64", "windows"] # no arm64 Linux build; the check is skipped there
```

One gspot version pins one version of every managed tool. Locked dependencies and the package-manager version are
also inputs to the installation. Host tools and the project's TypeScript retain their own
versions; reports name them instead of promising byte-identical environments. ESLint is pinned at the newest major that every shipped plugin supports.
A release test asks each registry for every pin, reads the ESLint range of every plugin, and
fails a pin below what a reference repository runs.

## How tools arrive

| Kind of tool                      | Where it installs                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| a native tool mise can install    | `.mise/conf.d/gspot-tools.toml`, under the mise runner                                        |
| an npm tool or library            | `.gspot/node_modules`, from `.gspot/package.json`, with the package manager of the repository |
| a Python tool                     | `.gspot/.venv`, from `.gspot/pyproject.toml`, with uv                                         |
| a host tool, such as `xcodebuild` | nowhere; `doctor` reports whether it is present                                               |
| any tool, with no mise            | nowhere; `doctor` prints the install command of the platform                                  |
| a repository with no JavaScript   | the npm tools install with bun or npm, whichever the machine has, bun first                   |

`gspot apply` resolves and writes tool lockfiles. `gspot install` installs their recorded contents
without changing tracked files. A missing or conflicted lockfile requires `apply` first.
No package lifecycle script or setup task runs gspot automatically.

The lint tools of gspot are tools, not
dependencies of the repository. gspot never writes
one into `package.json`, and the ESLint of the developer, its config, and its plugins stay as
they are. The generated ESLint config sits in `.gspot/`, so its imports resolve there. The type
check keeps the TypeScript of the repository, because `tsc` answers for the build the developer
ships.

The install under `.gspot/` takes the registry, the proxy, and the token of the repository from
the package manager. It stays a project of its own inside a pnpm or Yarn workspace. An install
hint names Homebrew only for a tool with no pin, because Homebrew installs the
current version alone.

Every tool in the kits has a Windows build except `plutil`, `xcodebuild`, `xcstringstool`,
`swiftlint`, `swiftformat`, and `periphery`. Their checks are platform skips elsewhere.
A tool pin names the platforms it ships for under `platforms`. Each entry is an operating system
alone, or one with an architecture. CodeQL ships no arm64 Linux build, so its check is a platform
skip there.

## One tool per job

A tool enters a configuration only when it does something no tool already in the set does. Applied to
the reference set, these were cut, and every rule they enforced is re-pointed in the acceptance record:

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

`check` runs the same inspection for the tools its checks need, once for a run.

## Upgrade

Install the intended gspot version through the package manager. Preview its generated changes
with `gspot apply --dry-run`, then run `gspot apply`. Preserve custom configuration and record
the new pin only after successful application. Run `gspot install` to install the resulting locks.
No version migrations or release-PR machinery are maintained before release.

## Rollback

Restore the previous complete policy, generated files, locks, and version pin from Git or recovery.
Install the matching gspot version and run `gspot install`. Do not execute publication or deployment during cleanup.

## Network

The install of tools reaches
the registries. `apply` may reach registries to resolve changed tool locks and downloads Vale packages at `all`. Immutable `install` only installs recorded dependency contents; it never regenerates locks. `check` and the
hooks never reach the network, except for a check that declares `network`, which sits at `push`
or `manual`.
