# Slow Checks and the Cache

Row 3 of the build order. The first install in yap-swift-app took 35 minutes, and a full push took
45 (A-4). Most of that time is work done twice. A file is parsed for each check, and `.gspot/` is hashed
for each check. A process starts for each file, and a compile check pays for a clean build.

This step removes the repeated
work. It adds no time budget, because a gate that skips checks by the clock gives two verdicts
on two machines (D-102).

What runs when is fixed by D-122. `gspot check` runs everything, and the hooks run what changed.
The checks that build, test, or scan a whole project run at the `manual` stage and in CI.

## K-43: every check hashes all of `.gspot/`

Closes K-43, K-44, and K-71.

**What is wrong.** `generatedHash` in `run/execute.ts:36` hashes every file under `.gspot/` for
each planned check, and one change there clears every cached verdict. `fileHash`
(`run/cache.ts:38`) turns a whole file into base64 before it hashes it. The cache has no limit:
this repository held 7,901 entries, and the 7 GB Swift build folder sat inside it.

**Target.** A cache key holds the hashes of the config files its check names, computed once for
a run. The verdict cache drops entries older than 30 days. A build folder of a tool sits in the
cache folder of the platform (D-105).

**Files.** `run/cache.ts`, `run/execute.ts`, `run/session.ts`, `platform/paths.ts`,
`checks/swift/build.ts`.

**Logic.** `Session` gains `configHashes`, a map filled on first use. `cacheKey` takes the
`{config:<name>}` parts of the check command, and for an engine check the config names of its
manifest. `fileHash` hashes the bytes through `Bun.hash`. `pruneCache` runs at the end of a full
run and removes entries whose file time is over 30 days. `platform/paths.ts` gains
`buildFolder(root)`: `~/Library/Caches/gspot/<hash of root>` on macOS, and `$XDG_CACHE_HOME/gspot` on Linux.

**What goes.** `generatedHash`, and the base64 step.

**Tests.** A unit test edits `.gspot/ruff.toml` and holds that the cached verdict of
`bash/shellcheck` still stands. A second one ages an entry and holds that it is gone.

**Done when.** A second `gspot check` in this repository reads the cache for every check whose
inputs did not change, after an edit of one generated file.

## K-53: `init` opens three sessions and applies twice

Closes K-53 and K-127.

**What is wrong.** `lifecycle/init/command.ts` opens a session to propose, one to apply, and one
to check, and `first-check.ts` applies again. The first run covers every stage. `upgrade` runs
every check of every stage again, as `init` does.

**Target.** `init` opens one session, applies once, and runs the commit stage alone (D-102). The
first counts of a later stage are written by `gspot baseline` after a full run (D-132).
`upgrade` runs only the checks the new version adds or changes.

**Files.** `lifecycle/init/command.ts`, `lifecycle/first-check.ts`, `lifecycle/upgrade/command.ts`,
`checks/docker/trivy-image.ts`.

**Logic.** `openSession` returns a session that `applyAll` updates in place with the files it
wrote. `upgrade` runs a check whose id the last record does not hold, and a check whose generated
config file the apply of the upgrade changed. The apply report already lists those files. A finding of the image scan is one line:
the package, the advisory id, and the fixed version.

**What goes.** The second and third `openSession` of `init`, and the second `applyAll`.

**Tests.** A unit test counts `openSession` calls in `init`. The planted install with defaults
holds that no push-stage check ran.

**Done when.** `init --yes` in the planted Swift package ends in under a minute on the CI runner.

## K-125: whole files read for their first bytes

**What is wrong.** `head` in `repository/tracked.ts`, `sniff` in `repository/tags.ts`, and
`hasBanner` in `repository/natures.ts` each read a whole file and cut it. Every command does this
for most tracked files when it opens.

**Target.** One read of the first 4 KB of a file, shared by the three.

**Files.** `repository/tracked.ts`, `repository/tags.ts`, `repository/natures.ts`.

**Logic.** `head(path)` opens the file, reads 4,096 bytes, and keeps them on the `TrackedFile`.
`sniff` and `hasBanner` take that buffer.

**What goes.** Two whole-file reads for each file.

**Tests.** A unit test with a 50 MB file holds that opening a session reads under 1 MB.

**Done when.** That test passes.

## K-138: two full parses for the naming checks

Closes K-138 and K-148.

**What is wrong.** `identifierFindings` and `schemaFindings` in `naming/engine.ts` each parse
every source file. Each of the five Swift structure checks parses every Swift file on its own,
and the Python checks do the same. The shell checks already share `shellIndex`.

**Target.** A source file is parsed once for a scope and a run, for every engine.

**Files.** `structure/parser.ts`, new `structure/parsed-scope.ts`, `naming/engine.ts`, and the
analyses of Swift and Python under `structure/analyses/`.

**Logic.** `parsedScope(session, scope, grammar)` returns the trees of a scope, held on the
session under the scope path and the grammar. The naming engine, the structure analyses, and the
cross-file index all ask it. `shellIndex` becomes one user of it.

**What goes.** The parse loop inside each analysis file.

**Tests.** A unit test counts parser calls for a full run over a planted Swift package, and holds
one call for each file.

**Done when.** That test passes.

## K-143: a clean Swift build on every run

**What is wrong.** `ranBuild` in `apple/build.ts` runs `xcodebuild clean build-for-testing` into a
derived data folder of its own, and deletes the scratch folder of a package first. The analyzer
needs the log of a complete build, and `swift/build` pays for it too.

**Target.** `swift/build` builds incrementally. The analyzer keeps the clean build and runs at
the `manual` stage (D-122).

**Files.** `checks/swift/build.ts`, `checks/swift/analyzer.ts`, `checks/swift/plan.ts`,
`presets/swift/manifest.toml`.

**Logic.** Two build plans. The compile plan has no `clean` and uses `buildFolder(root)`. The
analyzer plan keeps `clean` and writes the log the analyzer reads.

**What goes.** The shared plan that made one build serve both.

**Tests.** The Swift planted test runs `swift/build` twice and holds that the second run takes
under a third of the first.

**Done when.** That test passes on the macOS runner.

## K-162: one git process for each migration

**What is wrong.** `committedText` in `postgres/history.ts` starts one `git show` for every
migration, and `postgres/migration-order` reads the first of them twice. A project with 300
migrations starts 600 processes.

**Target.** Two git processes for any number of migrations.

**Files.** `readers/postgres-schema.ts`, `checks/postgres/migration-order.ts`,
`checks/postgres/migrations-frozen.ts`.

**Logic.** One `git ls-tree -r <upstream> -- <folder>` gives the committed names and blob ids.
One `git diff --name-status <upstream> -- <folder>` gives what changed. No file content is read
for a migration that did not change.

**What goes.** `committedText`.

**Tests.** A unit test with a spy on the git spawn holds two calls for 50 migrations.

**Done when.** That test passes.

## K-176: Vale starts once for every source file

**What is wrong.** Python, shell, and SQL files reach Vale through stdin under a borrowed
extension (`PROSE_GRAMMARS` in `config/prose.ts`, `routeGroups` in `prose/grammars.ts`). A
repository of 800 Python files starts Vale 800 times. Python goes under the Ruby extension,
although Vale reads `.py` itself. CSS comments are never read.

**Target.** Vale runs once for each extension, over paths.

**Files.** `presets/prose/vale.ini.tmpl`, `prose/grammars.ts`, `prose/vale.ts`,
`presets/prose/manifest.toml`.

**Logic.** `vale.ini` maps a borrowed extension under `[formats]`, the key Vale has for this:
`sh = py` style lines for the languages Vale does not read. Python, CSS, and every other language
Vale reads go by their own extension. `alerts` takes paths in batches through `fileBatches`.

**What goes.** The stdin route, the path rewriting that came with it, and `PROSE_GRAMMARS`,
which becomes a setting of the prose manifest.

**Tests.** A unit test with a spy holds one Vale spawn for ten Python files. The prose planted
test holds a finding in a CSS comment.

**Done when.** Both pass.

## K-196: commit-stage checks that read a whole scope

**What is wrong.** 83 of the 168 checks at the `commit` stage take no file list. Among them are
`typescript/tsc`, `javascript/checkjs`, `nextjs/typecheck`, and `python/basedpyright`. They read
a whole scope on every commit, however small.

**Target.** A check is at `commit` when it takes the staged files, or when it ends within five
seconds on the planted repository of its preset. Every other check is at `push` or `manual`.

**Files.** The manifests, and a new `tests/release/check-times.test.ts`.

**Logic.** The test runs each commit-stage check on the planted repository of its preset, warm,
and fails one that takes over five seconds with no file list. The type checkers move to `push`.
The commit hook still runs a whole-project check of a project that holds a staged file, where the
manifest marks it `runs = "per-scope"` and it passes the test (D-122).

**What goes.** Nothing.

**Tests.** That test, which also closes T-12 for the staged run.

**Done when.** It passes, and a commit of one file in this repository ends in under ten seconds.
