# Before Launch

The [active CI bypass](../22-remaining.md#active-ci-bypass) applies to every release and
platform requirement below. Do not start or wait for CI until the user explicitly re-enables
it. Record unexecuted platform acceptance as deferred and continue local implementation.

Implement and test these code and packaging fixes before the app handoff.
Follow [22-remaining.md](../22-remaining.md). Actual public publication and registry ownership are
release gates after adoption, not prerequisites for testing through the local registry.
Each row here can ship a broken or an unlawful package, and local testing alone is insufficient.

## K-263: Windows and packaged-platform acceptance remain incomplete

**Current status.** Windows setup, self-checks, unit tests and planted repositories have run
in GitHub Actions. Historical successful runs do not close later failures or packaged-binary
acceptance. See [the repository audit](../23-repository-audit.md) for the timeout evidence and
its limits. The active CI bypass defers further remote verification.

**Original defect.** The Windows job skipped setup and self-check and failed at checkout.
The repairs and subsequent failures below are historical evidence, not instructions to repeat
already completed patches.

**Target.** The Windows job runs the unit tests, the planted repositories, and `gspot check`.

**Files.** `.github/workflows/ci.yml`, `emit/hooks.ts`, `platform/spawn.ts`, `platform/paths.ts`.

**Logic.** The two `if: runner.os != 'Windows'` lines go. The hooks keep Bash, because Git for
Windows ships it, and their header says so. Each failure of the first Windows run becomes a row
of [18-gaps.md](../18-gaps.md), with its fix, before the launch.

**What goes.** The two conditions.

**Tests.** The job, including a checkout path with spaces and Unicode. K-306 replaces raw file-URL pathname conversion in scripts and the harness.

**Done when.** It is green.

**Observed after the checkout repair, September 20, 2026.**
[Windows job 106008873358](https://github.com/stefanionescu/gspot/actions/runs/35484718384/job/106008873358)
reaches tool installation and fails on two dependencies. SwiftLint 0.63.2 has no Windows
artifact. RuboCop 1.91.0 fails to build a native gem extension. The setup step now runs
on Windows, but the job has not reached the test suite.

D-136 removes the Ruby dependency. SwiftLint installation is restricted to Linux and macOS.
The Windows test suite and self-check still require successful CI evidence. Unexecuted
checks cannot count as findings or passes.

[Windows job 106022412785](https://github.com/stefanionescu/gspot/actions/runs/35489701634/job/106022412785)
passes tool installation at `fbfb142f032d4712eacef69526038d5fe5485358`, then fails in
the plugin build. A raw file-URL pathname produces an invalid drive path. K-306 replaces
that conversion in scripts, source asset lookup, and the test harness. The next Windows
run must verify setup and expose any remaining failures.

The planted test harness uses the native path delimiter and directory extraction when
building tool search paths. Its executable-resolution test exercises the resulting first
search-path entry. This removes the hard-coded POSIX separators before Windows tests run.

[Windows job 106023465084](https://github.com/stefanionescu/gspot/actions/runs/35490101242/job/106023465084)
reaches the full suite at `20dff88ef5`. It passes 377 tests and fails 66. Most failures
cannot find `bun` or `git` after a test replaces `PATH`. The environment snapshot now
normalizes Windows variable names, so a native `Path` entry is preserved when callers
prepend to `PATH`. A subprocess regression test checks inherited executable lookup.

The encoded-checkout asset test passes on Windows. Two plugin export tests also fail because
the current resolver uses POSIX-only paths for filesystem reads. Native path operations
repair that resolver while the rule remains in use. K-102 still owns its later replacement.

SwiftLint declares `windows = false` in its tool metadata. The planted Swift tests
require an explicit unsupported-platform result on Windows for SwiftLint, while keeping
finding assertions for SwiftFormat and the built-in Swift checks. Linux and macOS retain
the SwiftLint finding assertions.

Windows run `35490574212` completes 450 tests with 21 failures. Three failures expect
findings from Ansible, Gixy, and Semgrep despite their existing Linux/macOS restrictions.
Their tests require explicit platform skips on Windows and still exercise real findings
on supported hosts. The tests themselves run on every host, including scheduling assertions.
The other failures remain under investigation; this is not full Windows acceptance.

The dirty-initialization test repository cannot find Prettier on Windows because its added npm
binary directory ends with a POSIX path delimiter. Sixteen repository test data repeat
that construction. Each uses the native delimiter and joins the npm binary directory
with native path operations. The harness already preserves the inherited search path.

Mise-installed Commitlint and Markdownlint fail to load `semver` and `unicorn-magic`
on Windows in the same run. Repository setup selects npm as the installer for npm
tools, using the existing pinned Node runtime. This is an explicit
[Mise installer setting](https://mise.jdx.dev/dev-tools/backends/npm), not a dependency
added to the application. An isolated installation rejects invalid commit messages and
Markdown, and accepts a valid commit message. Windows acceptance still requires CI.

Profile import treated only a leading slash as an absolute path. A Windows drive path
was appended to the destination repository, so loading failed. Profile loading uses
native path resolution. Its regression loads the same profile by a relative path and by
an absolute path from another working directory. Test paths contain spaces and Unicode.

SwiftFormat 0.61.1 publishes its Windows executable in a Windows Installer package. CI extracts that pinned
package administratively into a temporary directory, copies the executable into the
Mise tool directory, and verifies its version. The helper removes its extraction directory
on completion or failure and rejects unexpected script arguments. This supplies the
Windows CI prerequisite. Product installer acceptance remains open.

The linked Next.js test repository uses a temporary sibling of the checkout, so its dependencies
and generated application share a drive. The [Windows job 106028903542](https://github.com/stefanionescu/gspot/actions/runs/35492181462/job/106028903542)
shows webpack prefixing a dependency on drive D with `./` from a test repository on drive C.
The test repository still runs clean and failing builds. Other test data retain their system
temporary directories, and layout acceptance remains open under K-306.

The CI self-check step runs on Windows after the tests and native build succeed.
No platform condition skips that command. Successful Windows evidence remains required
before K-263 closes.

The [Windows job 106030240212](https://github.com/stefanionescu/gspot/actions/runs/35492697272/job/106030240212)
passes SwiftFormat extraction and the version probe, then reports exit 5 during actual
linting. Setup also runs a minimal formatting smoke check with the tool cache disabled.
A setup failure includes the exit code and both output streams. The cause of the lint
failure remains unconfirmed, and the Swift acceptance tests remain required.

The PostgreSQL test repository times out after five minutes in
[Windows job 106029693038](https://github.com/stefanionescu/gspot/actions/runs/35492486973/job/106029693038),
then passes in 25.97 seconds in the next Windows job. Its cause remains unconfirmed.
The planted harness gives each CLI subprocess a two-minute deadline and reports the
command, working directory, and captured output when that deadline expires. A boundary
regression preserves both streams, and the outer test deadlines are unchanged.

The minimal SwiftFormat smoke check passes on Windows with verbose mode and caching
disabled. [SwiftFormat 0.61.1 source](https://github.com/nicklockwood/SwiftFormat/blob/0.61.1/Sources/CommandLine.swift)
shows that verbose mode disables its internal concurrency. The setup probe checks the
same file with each combination of verbose mode and caching, records every result,
and fails if any combination fails. This distinguishes those modes before selecting
a preset change.

All four minimal-input mode combinations pass on Windows. The next smoke probe uses
a function with a string interpolation. The probe compares an empty configuration with
the shipped SwiftFormat template rendered through the normal template owner. It records
each mode under that configuration. No preset workaround is accepted from the minimal probe alone.

**Local subprocess evidence, September 20, 2026.** Real-process tests exercise native
asynchronous and synchronous dispatch and both production cross-spawn entry points on macOS.
They preserve successful and finding exit statuses, drain both streams beyond pipe-buffer
capacity, distinguish missing and denied executables, and distinguish deadlines from other
signals. The cross-spawn completion waits for closed streams and classifies timeout from its
own timer. Synchronous output normalizes the nullable fields observed under Bun.
A failed Bun stream read terminates and awaits the child before reporting failure.

The focused process and planted-harness suites pass 37 tests with 309 assertions. This is
local backend evidence, not a reproduction or explanation of the historical Windows shell,
PostgreSQL, or secrets failures. Windows native-parent comparisons, isolated and suite-order
test repository runs, coverage comparisons, and packaged execution remain platform verification
deferred while CI is bypassed. The permission-bit test repository is POSIX-specific; Windows denied
launch still needs its platform reproducer.

## K-164: a release can ship broken and say nothing

Closes K-164, K-145, K-121, K-244, and K-245.

**What is wrong.** `publish.ts` prints a line and goes on when the binary of one platform is
missing, and the launcher still names that package. `build.ts` does the same for a missing
grammar. No published package ships `LICENSE.md`. `upgrade --dry-run` asks the npm registry for the newest `gspot`, and nobody has confirmed that
this project owns the name.

An install hint names Homebrew for a pinned tool, and Homebrew cannot install a
pin. The binary embeds 34 dependencies and nine grammars with no notice file, and `swift.wasm` is
tracked with no record of its source.

**Target.** A release fails before it publishes anything that is incomplete.

**Files.** `packages/cli/build.ts`, `packages/cli/publish.ts`, `packages/npm/gspot/package.json`,
`packages/eslint-plugin/package.json`, `platform/install-hints.ts`, new
`packages/cli/grammars/swift.build.ts`, `NOTICE.md`.

**Logic.** K-305 validates all script arguments before any writes or registry operations. Both scripts throw at the first missing file. `publish.ts` verifies every package
with `npm pack --dry-run` before it publishes the first, and each `files` list names
`LICENSE.md` at each package root. Platform packages also include `NOTICE.md` for bundled
inputs. The launcher and external-dependency plugin do not inherit unrelated CLI notices.
The CLI build reads actual bundler inputs and embedded grammar sources. Its notice assembler
lives beside the build entry point; pinned upstream supplements and provenance live under
root `LICENSES/`. Retain upstream text until installed dependencies supply the required
material. Include the Bun runtime and vendored Swift grammar provenance. A dependency-tree
scanner is not a substitute: installed dependencies are not necessarily bundled inputs.

`swift.build.ts` builds the grammar from a pinned commit of `tree-sitter-swift`. An install hint
names Homebrew only for a tool with no pin, and a `github` installer takes the tag form its
repository uses. The owner publishes a placeholder of `gspot` on npm before the release workflow
first runs.

**What goes.** The two print-and-continue branches.

**Tests.** `tests/release/publish.test.ts` removes one binary and holds a failed publish with
nothing in the registry.

**Done when.** It passes, and `npm view gspot` names this project.

## K-280: Alpine, and the first download

**What is wrong.** The five targets leave out Alpine, where the glibc binary does not start. Many
GitLab and Docker images are Alpine. A macOS binary that a browser downloads is quarantined, and
a Windows one meets SmartScreen.

**Target.** Seven targets, and an install guide that says what each system shows.

**Files.** `config/targets.ts`, `packages/cli/build.ts`, `packages/cli/publish.ts`,
`packages/npm/gspot/gspot.js`, `emit/workflow.ts`.

**Logic.** `targets.ts` gains `linux-x64-musl` and `linux-arm64-musl`, built with the musl
targets of Bun. The launcher reads the libc of the machine before it picks a platform package.
The macOS binaries are signed ad hoc at build, and the guide names `xattr -d` for a browser
download. mise and npm installs are not quarantined, and the guide recommends them first.

**What goes.** Nothing.

**Tests.** The release job runs `gspot --version` in an Alpine container for both musl targets.

**Done when.** It passes.

## K-281: renames after the first release

**What is wrong.** D-134 forbids every alias and rests on gspot having no release. Nothing says
what a rename costs a user afterwards.

**Target.** D-159: `gspot upgrade` rewrites a renamed key of `gspot.toml`, and its plan lists
each rewrite.

**Files.** `lifecycle/upgrade/command.ts`, new `lifecycle/upgrade/renames.ts`,
`policy/write.ts`.

**Logic.** `renames.ts` holds one table: the version, the old key, and the new key. `upgrade`
reads old TOML without first applying the new schema, applies ordered rows in memory, then validates the migrated target. It plans config, generated files, locks, and version pin together; preserves originals; and changes the pin last.

It is allowed to run across a pin mismatch. Failure and retry follow [02-cli.md](../02-cli.md). The table is empty at the first release.

**What goes.** Nothing before the release. D-134 holds until then.

**Tests.** An old name rejected by the new schema still migrates. Cover dry-run, unknown migration, pin mismatch, lock-resolution failure, interruption before pin update, and safe retry with original recovery retained.

**Done when.** It passes.

The shipped configuration reproduces exit 5 on Windows with every cache and verbosity
combination. The same function passes with an empty configuration. Setup probes each
rendered setting separately to identify the failing option before changing formatter policy.

The per-setting Windows probe isolates exit 5 to `--header strip`. Every other setting
passes separately. K-219 requires removing that destructive option and the SwiftLint
header ban. The setup smoke check retains the complete shipped configuration and now
includes a copyright header, so Windows must lint that combination successfully.

The Windows document suite reaches its missing-dictionary scenario after the Vale path fix.
It fails while removing a directory symlink with `rmSync`. The test repository uses `unlinkSync`
to remove only that link and then exercises the expected Vale error.

All three CI test suites and binary builds pass at `2397e0a`. Windows runs 457 tests
successfully with five platform or release skips. Its repository self-check exposes
CRLF checkout differences, a command length limit, and a v8r file-pattern separator defect.
The repository attributes require LF text checkouts to match its existing EditorConfig
policy. A disposable Git checkout verifies that this overrides automatic CRLF conversion
while preserving binary bytes. Runtime support for CRLF inputs remains separate work.

The Windows Markdownlint failure at `2397e0a` exceeds the command limit of its npm
wrapper. File batching reserves the resolved executable and fixed arguments before
adding paths. Windows batches account for quoting and double escaping within a
7,000-character budget. Unix batches count UTF-8 bytes. Regression tests cover
5,000 paths, Unicode, oversized arguments, and subprocess argument preservation.

The subprocess test exercises a `.cmd` shim on Windows. Side commands and fixers
still need the batching work owned by the execution fixes.

The v8r failure at `2397e0a` receives `.changeset\config.json` as a pattern and
finds no files. Tool file arguments retain the forward slashes of repository paths.
A planted test validates `settings/café.json` against a local schema through v8r.
It reports the invalid value and passes after the value is corrected. Both runs
select only the staged file and disable the cache.

The macOS jobs for `02a430a` and `6cb1393` fail before the profile dry run starts.
Git background maintenance removes `.git/objects/maintenance.lock` during the initial
repository snapshot. The planted Git helper disables automatic maintenance and garbage
collection. The dry-run test keeps its complete snapshot assertion, including Git files.

The platform workflow runs the repository self-check after setup and type checking.
The full test suite and binary build follow. This exposes tool invocation failures
without waiting for the planted suites. All steps remain required for a green job.
