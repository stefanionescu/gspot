# Toolchain

This document decides how gspot itself is installed and pinned, and how the tools gspot runs are
pinned, installed, verified, and upgraded. gspot pins, the package managers install, and
`doctor` verifies.

## Installing gspot

gspot is one binary for each platform. It is published to GitHub Releases, and to npm as a
launcher package over one package for each platform. Three ways to get it:

| Way                  | Command                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| mise                 | `mise use -g github:stefanionescu/gspot` for a global copy                                      |
| npm, pnpm, yarn, bun | `npx gspot init` or `bunx gspot init`; the `gspot` package is a launcher with no install script |
| release asset        | download `gspot-<os>-<arch>` from the release page and put it on `PATH`                         |

A `curl | sh` installer is never offered, because the rule files ban the pattern.

A global install exists to run `gspot init` in a repository that has nothing yet. After `init`,
the repository pins its own version in two places. `.gspot/version` is one tracked line that
every command reads. The runner holds the second: the mise file of gspot, or the `gspot` line of
`devDependencies`. The hook and the tasks find that pinned version, so two people on one
repository run the same gspot.

A binary of another version than `.gspot/version` exits 2 on every command that reads the
config. It prints the two ways forward: install the pinned version, or move the pin with
`gspot apply`. `init`, `doctor`, `explain`, `list`, `--version`, and
`--help` run under any version. Package managers update gspot itself.

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
harness, which `GSPOT_REGISTRY` names. The redo of yap-swift-app runs that way, and no
tracked file holds the address.

The first release needs these, in this order:

1. The npm organization `gspot` and the package name `gspot`, owned by this project.
2. A public repository.
3. Trusted publishing set up for each package.
4. The domain that serves the manual.
5. Every row of [22-remaining.md](22-remaining.md) closed, and the Windows job green.

## Pins

Every configuration lists its tools with one version and the name under each installer. An installer
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
versions; reports name them instead of promising byte-identical environments. ESLint is pinned at the newest major that every shipped plugin supports.
A release test asks each registry for every pin, reads the ESLint range of every plugin, and
fails a pin below what a reference repository runs.

## How tools arrive

| Kind of tool                      | Where it installs                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| a binary mise can install         | `.mise/conf.d/gspot-tools.toml`, under the mise runner                                        |
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

Every tool in the configurations has a Windows build except `plutil`, `xcodebuild`, `xcstringstool`,
`swiftlint`, `swiftformat`, and `periphery`. Their checks are platform skips elsewhere.

## One tool per job

A tool enters a configuration only when it does something no tool already in the set does. Applied to
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

Install the intended gspot version through the package manager. Preview its generated changes
with `gspot apply --dry-run`, then run `gspot apply`. Preserve custom configuration and record
the new pin only after successful application. Run `gspot install` to install the resulting locks.
No version migrations or release-PR machinery are maintained before release.

## Rollback

Restore the previous complete policy, generated files, locks, and version pin from Git or recovery.
Run the matching binary and `gspot install`. Do not execute publication or deployment during cleanup.

## Network

The install of tools reaches
the registries. `apply` may reach registries to resolve changed tool locks and downloads Vale packages at `all`. Immutable `install` only installs recorded dependency contents; it never regenerates locks. `check` and the
hooks never reach the network, except for a check that declares `network`, which sits at `push`
or `manual`.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-264

`gspot install` sets up one clone. It installs the mise tools,
`.gspot/node_modules`, `.gspot/.venv`, and the hooks, writes no tracked file, and is safe
to run twice. Before the first release it takes its packages from the local registry that
`GSPOT_REGISTRY` names.

`tool-environment.ts` writes `.gspot/pyproject.toml` from every tool with a `pypi`
name, and `install` runs `uv sync --locked --project .gspot`. The probe looks under `.gspot/.venv/bin`
after `.gspot/node_modules/.bin`. `init` call the function, and `--no-install`
skips it. The developer runs `gspot install` explicitly; no setup or lifecycle script is injected. `apply` resolves lockfiles, while `install` uses only matching locked contents.

`missing-tool.ts` prints `Run: gspot install` for a tool gspot can install, and the
platform hint for a host tool. `check` prints the same line once when the hooks of the config do
not run in this clone. The plan counts the binaries that need mise, and where mise is absent it
shows the one line that installs mise and then all of them.

A planted clone: `git clone` of an installed repository, then `gspot check` holds the
line, then `gspot install`, then a commit runs the hook. A planted Python repository with no mise
and uv alone runs `python/ruff`. The harness starts the registry and sets `GSPOT_REGISTRY` for
every planted install.

### Acceptance K-297

A missing tool never blocks the setup. `init` writes the config on
any machine, `install` installs what it is able to and lists the rest, and gspot installs no
system software unasked.

`install-tools.ts` picks the package manager in this order: the root, the
first JavaScript project, bun or npm on the machine, then bun from the mise file of gspot.
`emit/mise.ts` pins bun only in that last case, and pins uv where a Python tool is selected.

Each step of the install runs even when an earlier one failed. The command ends with one list of what
is left, each entry with its command. It exits 1 when a tool gspot installs itself is on the
list, and a host tool such as Xcode leaves the exit code alone. `init` exits 0
once the config is written, and prints the same list.

Three planted machines, each a `PATH` with tools left out. A Swift repository with
mise and no Node installs the npm tools through bun. A Python repository with no mise and no uv
ends `install` with exit 1 and one line for uv. A repository with nothing but gspot finishes
`init` with exit 0.

### Acceptance K-206

An installer that numbers differently carries its own version.

An installer value is a name, or a table with `name` and `version`. A release test
asks npm, PyPI, crates.io, and GitHub for every pin. It runs with the release suite, because it
calls the network.

That release test.

### Acceptance K-263

Use the standard filesystem boundary and verify the installed binary, unit/plugin and behavioral journeys on Windows. Include checkout paths with spaces and Unicode, LF generated output, command shims, cancellation, and process-tree cleanup. Windows execution is deferred while CI is paused; unsupported-platform refusal is not completed native support.

### Acceptance K-164

A release fails before it publishes anything that is incomplete.

K-305 validates all script arguments before any writes or registry operations. Both scripts throw at the first missing file. `publish.ts` verifies every package
with `npm pack --dry-run` before it publishes the first, and each package includes
the project license from distribution output. Platform packages also include `NOTICE.md` for bundled
inputs. The launcher and external-dependency plugin do not inherit unrelated CLI notices.
The CLI build reads actual bundler inputs and embedded grammar sources. Its notice assembler
lives beside the build entry point; pinned upstream supplements and provenance live in
`packages/cli/scripts/notices.json`. Retain upstream text until installed dependencies supply the required
material. Include the Bun runtime and vendored Swift grammar provenance. A dependency-tree
scanner is not a substitute: installed dependencies are not necessarily bundled inputs.

`swift.build.ts` builds the grammar from a pinned commit of `tree-sitter-swift`. An install hint
names Homebrew only for a tool with no pin, and a `github` installer takes the tag form its
repository uses. The owner publishes a placeholder of `gspot` on npm before the release workflow
first runs.

Release acceptance removes one required binary, invokes the publication owner, and verifies
failure before any registry publication. Keep that regression with the existing release
argument and installed-consumer tests; no separate publish test file is required.

### Acceptance K-280

Seven targets, and an install guide that says what each system shows.

The shared target definition includes Linux x64 and arm64 musl builds using the corresponding
Bun compile targets. The launcher reads the libc of the machine before it picks a platform package.
The macOS binaries are signed ad hoc at build, and the guide names `xattr -d` for a browser
download. Document quarantine behavior for the verified delivery route; do not promise a host security
policy solely from the package manager name. Recommend only published, verified install routes.

The release job runs `gspot --version` in an Alpine container for both musl targets.

### Acceptance K-281

Apply the installed version without migrating policy. Dry-run is read-only. Preserve originals and recovery before publication, and update the pin last. Verify pin changes, edited outputs, lock failure, interruption, and safe retry.

## Internal build arguments

The CLI compiler always compiles an executable with syntax minification. Its internal interface
accepts the entry, target, output path, and metadata path. It exposes no flags that suggest these
fixed operations can be disabled. Cross-compilation does not establish native execution evidence.
