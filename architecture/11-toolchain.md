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
| GitHub release | the five binaries and `checksums.txt`, each binary attested                              | mise, and the CI job without mise                      |
| npm            | `gspot`, one `@gspot/cli-<os>-<cpu>` package for each target, and `@gspot/eslint-plugin` | `npx gspot`, and `.gspot/package.json`                 |
| `gspot.dev`    | the manual and `gspot.schema.json`                                                       | the `#:schema` line of every `gspot.toml`, and editors |

Every published package ships `LICENSE.md` and `NOTICE.md`. The release fails before it
publishes anything when one binary or one grammar is absent.

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

One gspot version pins one version of every tool, so two repositories on one gspot version run
the same tools. ESLint is pinned at the newest major that every shipped plugin supports (D-142).
A release test asks each registry for every pin, reads the ESLint range of every plugin, and
fails a pin below what a reference repository runs.

## How tools arrive

| Kind of tool                      | Where it installs                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| a binary mise can install         | `.mise/conf.d/gspot-tools.toml`, under the mise runner                                        |
| an npm tool or library            | `.gspot/node_modules`, from `.gspot/package.json`, with the package manager of the repository |
| a Python tool                     | mise, through its `pipx` backend                                                              |
| a host tool, such as `xcodebuild` | nowhere; `doctor` reports whether it is present                                               |
| any tool, with no mise            | nowhere; `doctor` prints the install command of the platform                                  |

The lint tools of gspot are tools, not dependencies of the repository (D-145). gspot never writes
one into `package.json`, and the ESLint of the developer, its config, and its plugins stay as
they are. The generated ESLint config sits in `.gspot/`, so its imports resolve there. The type
check keeps the TypeScript of the repository, because `tsc` answers for the build the developer
ships. An install hint names Homebrew only for a tool with no pin, because Homebrew installs the
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
the `.venv/bin` of the scope, mise, and `PATH`. It never reads the `node_modules` of the
repository for a lint tool. It runs the version command the manifest names and compares:

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
  move the pin to 0.5.0, write .gspot/ again, install the tools, run and hold what the new checks find
```

The rules section compares the rule lists of two configs as data, for every tool whose config
lists rules. `gspot upgrade` moves the pin, runs `apply`, installs the tools, and takes the
widening step for checks that are new or whose config changed (D-143). It never edits
`gspot.toml` and never commits. A setting that a version removes is an unknown key, and the
message names the keys that exist (D-134).

## Rollback

`gspot upgrade --to 0.4.0` writes the files of the older version. Generated files, the baseline
file, and rule files are tracked, so `git revert` of the upgrade commit followed by `gspot apply`
also brings the earlier state back.

## Network

`upgrade` reaches the network to find a newer gspot and to read it. The install of tools reaches
the registries. `apply` downloads the Vale packages at the level `all` alone. `check` and the
hooks never reach the network, except for a check that declares `network`, which sits at `push`
or `manual`.
