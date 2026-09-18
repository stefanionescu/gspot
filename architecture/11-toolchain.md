# Toolchain

This document decides how gspot itself is installed and pinned, and how the tools gspot drives
are pinned, obtained, verified and upgraded. gspot pins; the ecosystem installs; `doctor`
verifies.

## Installing gspot

gspot is one binary per platform, published to GitHub Releases and to npm as a launcher package
over one package per platform (D-52). Three ways to get it, in the order the manual recommends
them:

| Way | Command | For |
| --- | --- | --- |
| mise | `mise use -g ubi:stefanionescu/gspot` for a global copy; `.mise/conf.d/gspot.toml` pins it per repository | any repository; the only way that needs no Node for a Python or Swift repository |
| npm, bun, pnpm | `bunx gspot init`, `npx gspot init`; `devDependencies.gspot` pins it per repository. The `gspot` package is a launcher over per-platform packages (`@gspot/cli-<os>-<arch>`) listed as `optionalDependencies`, so the install downloads nothing and runs no script | JavaScript repositories, with nothing installed globally |
| release asset | download `gspot-<os>-<arch>` from the release page and put it on `PATH` | machines with neither |

Homebrew, winget and scoop packages follow v1. A `curl | sh` installer is never offered; the
corpus bans the pattern and gspot obeys its own rules.

A global install exists to run `gspot init` in a repository that has nothing yet. After `init`,
the repository pins its own version in two places: `.gspot/version` (one line, tracked, read by
every command) and the runner surface (`[tools] gspot = "0.5.0"` in `.mise/conf.d/gspot.toml`
through the `ubi:` backend, or `devDependencies.gspot` under a package manager). The hook and
the runner tasks resolve that pinned version (`mise exec -- gspot`, `bunx gspot`), so two people
on one repository run the same gspot whatever they installed globally.

A binary of another version than `.gspot/version` exits 2 on `check`, `sync` and the writing
commands and prints the two ways forward: install the pinned version (`mise install`, the package
manager's install) or move the pin (`gspot upgrade --to <this version>`). `init`, `doctor`,
`explain`, `why`, `--version` and `--help` run under any version. With runner `none` the pin is
`.gspot/version` alone and the hook calls the absolute path `init` recorded.

A newer gspot is announced in three places and nowhere else: the last line of `init`, `doctor`,
and `upgrade --check`. `check`, `sync` and the hooks never look.

## Pins

Every preset lists its tools with one version and the name under each installer:

```toml
[[tools]]
name    = "shellcheck"
version = "0.11.0"
mise    = "shellcheck"
brew    = "shellcheck"
apt     = "shellcheck"
github  = "koalaman/shellcheck"

[[tools]]
name    = "eslint-plugin-unicorn"
version = "74.0.0"
npm     = "eslint-plugin-unicorn"
floor   = "63.0.0"                  # doctor accepts this or newer

[[tools]]
name    = "ruff"
version = "0.14.1"
pypi    = "ruff"
mise    = "ruff"

[[tools]]
name     = "xcodebuild"
provider = "host"                   # present or the check fails; gspot cannot install it
```

One gspot version pins one version of every tool. Upgrading gspot moves the pins together, so two
repositories on the same gspot version run the same tool versions.

## How tools arrive

gspot downloads nothing. It writes pins into the surface the repository already uses and tells
`doctor` what to verify.

| Ecosystem | gspot writes | Person runs |
| --- | --- | --- |
| mise (recommended) | `.mise/conf.d/gspot.toml` `[tools]` with every pin, using `npm:`, `pipx:`, `ubi:` or `github:` backends where mise has no core plugin | `mise install` |
| npm, bun, pnpm | `devDependencies` in `package.json` for npm tools, after the yes in the plan; written and installed through `nypm`, which detects the manager from the lockfile and `packageManager` | the package manager's install |
| uv | `[dependency-groups] gspot = [...]` in `pyproject.toml` for Python tools, after the yes | `uv sync --group gspot` |
| Homebrew, apt, winget, scoop, cargo | nothing; `doctor` prints the install command for the platform it runs on | the command |
| host | nothing; `doctor` reports presence | install Xcode, Docker |

Platform notes: every tool in the presets has a Windows build except `plutil`, `xcodebuild`,
`xcstringstool`, `swiftlint`, `swiftformat` and `periphery`, which are macOS-only and whose checks
skip elsewhere as platform skips. `shellcheck`, `shfmt`, `typos`, `ruff`, `basedpyright`,
`gitleaks`, `osv-scanner`, `hadolint`, `semgrep`, `vale`, `lychee`, `taplo`, `actionlint` and the
npm tools run natively on Windows.

mise is recommended and proposed first because it handles every backend from one file, including
npm and pipx packages, so a Python repository needs no `package.json` to run ESLint over its
scripts. Without mise, gspot writes to the runner the repository has and reports the rest.

The ESLint plugins the generated config imports are npm tools. In a JavaScript repository they
are devDependencies. In a repository without one, mise installs them under `npm:` and gspot
renders the config to import them from mise's install path; without mise, JavaScript checks in a
non-JavaScript repository report `MISSING` with the mise hint.

`eslint-plugin-gspot` ships as an npm package from gspot's repository, pinned to the gspot
version, and arrives the same way.

## One tool per job

A tool enters a preset only when it does something no tool already in the set does. Applied to
the reference set, these were cut, and every rule they enforced is re-pointed in the ledger:

| Cut | Kept instead | Why |
| --- | --- | --- |
| lizard | sonarjs `cognitive-complexity` | sonarjs runs on every JavaScript file ESLint sees, in the editor |
| madge | `import-x/no-cycle` | same graph, CommonJS included |
| type-coverage | `tsc` strict, `no-explicit-any`, the `no-unsafe-*` rules | it measured what the rules already forbid |
| sort-package-json | `eslint-plugin-package-json` | orders, validates and fixes in one tool |
| pip-audit | osv-scanner | one advisory database over every lockfile, `uv.lock` included |
| bandit, the vendored bandit Semgrep set | Ruff `S` plus the Semgrep Python pack | Ruff `S` is the bandit port and runs in the editor |
| interrogate | Ruff `D100` to `D107` | same rule |
| pyright | basedpyright | stricter `all` mode; a native binary with no Node dependency |
| bearer | Semgrep | one rule format for the repository's own rules and the OWASP pack |
| gspot's own Markdown link checker | lychee `--offline --include-fragments` | lychee checks anchors |
| gspot's own version alignment | syncpack version groups | syncpack expresses pairs and ranges |
| trivy over lockfiles | osv-scanner for lockfiles; trivy for images and IaC | one scanner per surface |

Kept with a stated reason, where overlap looked possible: gitleaks and trufflehog (pattern
detection against live verification), lychee and linkinator (documents against a served
site), actionlint and zizmor (syntax against security), editorconfig-checker (covers files no
formatter touches), pydoclint (until Ruff `DOC` leaves preview), vulture (basedpyright reports
unused private symbols only).

## Verification

`gspot doctor` locates every tool the selection needs, in this order: the repository's own
`node_modules/.bin` and `.venv/bin`, mise's shims, `PATH`. It runs the tool's version command
and compares:

| State | Meaning | Effect on `check` |
| --- | --- | --- |
| ok | present at the pinned version, or at or above the floor | runs |
| outdated | present below the floor | fails the checks that need it |
| newer | present above the pin | runs; `doctor` notes it |
| missing | not found | fails the checks that need it, with the install hint |

`check` runs the same probe for the tools its selected checks need and caches the result for the
run.

## Upgrade

`gspot upgrade --check` compares the installed gspot's presets with the target version's:

```text
gspot 0.4.0 -> 0.5.0

rules
  + typescript      @typescript-eslint/no-unnecessary-condition   new      41 findings
  ~ structure       function_lines  60 -> 50                       stricter 22 findings
  - typescript      gspot/no-imports-after-statements              removed, import-x/first covers it

tools
  ~ eslint          9.38.0 -> 9.41.2
  + ast-grep        0.45.3       new, required by structure

rule files
  ~ general/agent/WORKING.md   12 lines changed
  + general/agent/GIT.md       new

presets available, not selected
  vitest            vitest in package.json

coverage
  + 14 files newly claimed   - 0 files lose a check

action on upgrade
  2 new baselines   1 tool to install (runs mise install after the yes)
```

`gspot upgrade` moves the pin in `.gspot/version` and the runner surface, re-renders, writes
baselines for rules that arrive with findings, runs the runner's install step so the bumped tools
are present (`--no-install` skips it and prints the command), and prints the report. It never
edits `gspot.toml`, never commits, and aborts when the target version claims fewer files than the
installed one.

A setting renamed or removed between versions fails to load with the old name, the new name and
the release note. There is no automatic migration of `gspot.toml`.

## Rollback

`gspot upgrade --to 0.4.0` re-renders from the older version. Because generated files, baselines
and rule files are tracked, `git revert` of the upgrade commit followed by `gspot sync` also
restores the previous state. A baseline written by the newer version for a rule the older one
lacks is reported by `sync --check` and removed by `sync --baseline`.

## Network

`upgrade --check` and `upgrade` reach the network to read the target version's presets.
`doctor` and the last line of `init` reach it once to learn whether a newer gspot exists, and
only when run by a person. `check`, `sync` and the hooks never do. A `network` requirement on a check is the check's own
(external links, advisory databases) and puts it at `push` or `manual`.
