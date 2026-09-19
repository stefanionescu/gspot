# Before Launch

The last step before the first release. Each row here can ship a broken or an unlawful package,
and none of them shows on a laptop.

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

**Tests.** The job.

**Done when.** It is green.

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

**Logic.** Both scripts throw at the first missing file. `publish.ts` verifies every package
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
applies the rows between the pinned version and its own through the one writer. The table is
empty at the first release.

**What goes.** Nothing before the release. D-134 holds until then.

**Tests.** A unit test with one row in the table.

**Done when.** It passes.
