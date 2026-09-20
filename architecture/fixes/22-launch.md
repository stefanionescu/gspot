# Before Launch

Implement and test these code and packaging fixes before the app handoff.
Follow [22-remaining.md](../22-remaining.md). Actual public publication and registry ownership are
release gates after adoption, not prerequisites for testing through the local registry.
Each row here can ship a broken or an unlawful package, and local testing alone is insufficient.

## K-263: gspot has never run on Windows

**What is wrong.** D-31 promises that gspot runs natively on Windows. The Windows job of `ci.yml`
skips `gspot:setup` and `gspot check`, and every run of it stopped at the checkout step (K-204).
The hooks are Bash files whose header says macOS and Linux. Eight source files branch on
`win32`, and no test enters one of those branches.

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
`LICENSE.md` and `NOTICE.md`. `build.ts` writes `NOTICE.md` from the license field and file of
every bundled dependency and grammar. The file ships beside each binary of the release and in
every package, so no flag prints it (D-163).

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
