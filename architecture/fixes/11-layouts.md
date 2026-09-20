# Checks That Assume One Layout

Row 15 of the build order, which is also the redo of the install in yap-swift-app. Several checks
were written against one repository and read its layout as the rule. They assume the root as the
only project, one folder depth for snapshots, one build command, and one SQL dialect. This step makes each
check read what the repository says. The redo of the app then measures the result, and that is
the one place where a number in this file comes from outside this repository.

## K-149: checks read the whole repository and ignore their scope

Closes K-149, K-155, and K-163.

**What is wrong.** `trackedEnding` in `apple/xcode/files.ts` reads `session.repository.files`, and
about forty check files do the same. A staged run of one file reads all of them. A repository
with two Swift scopes reports the files of one under the other. `SUPABASE_CONFIG` in
`config/supabase.ts` is a path from the root, so a project under `apps/backend/supabase/` is not
found. An SVG that svgo can make one byte smaller is a finding.

**Target.** A check that runs for a scope or a file list receives those files in its input. Only
a check with `runs = "once"` can reach the whole repository.

**Files.** `types/run.ts` (`EngineInput`), `run/engines.ts`, and every file under `src/checks/`
that reads `session.repository.files`.

**Logic.** `EngineInput` holds `files` and `scopeRoot`, and loses `session`. A check with
`runs = "once"` also gets `repositoryFiles`. The supabase reader finds `supabase/config.toml`
under `scopeRoot`. `static-site/svg-optimized` reports a saving over 10 percent at `recommended`,
and any saving at `all`.

**What goes.** `SUPABASE_CONFIG`, `trackedEnding`, and forty direct reads of the session.

**Tests.** A planted repository with two Swift scopes holds each finding under its own scope. A
planted Supabase project under `apps/backend/` is found.

**Done when.** A search of `src/checks/` for `session.` finds nothing.

## K-144: Swift files compared by name, and snapshots by one layout

Closes K-144, K-90, and K-150.

**What is wrong.** `xcode/orphan-sources` compares file names without folders, so two files of one
name hide each other. `xctest/reference-images` reported 954 orphans in the app, from a fixed
depth of three folders under `__Snapshots__`. A Swift test file is a file under a folder whose
name ends in `Tests`, so a Swift Testing file elsewhere gets no test check. A skipped test passes
with any string of eight characters on its line.

**Target.** Sources are compared by path. The snapshot layout is a setting with the default of
the snapshot library. A test file is found by what it imports.

**Files.** `readers/xcode-project.ts`, `checks/xcode/orphan-sources.ts`,
`checks/xctest/reference-images.ts`, `checks/xctest/disabled.ts`, new `readers/swift-tests.ts`,
`presets/tool/xctest/manifest.toml`.

**Logic.** The project reader resolves each file reference through its group path. The setting
`tools.xctest.reference_layout` is a pattern with `{file}` and `{test}`, by default
`__Snapshots__/{file}/{test}.*`. `swift-tests.ts` calls a file a test file when it imports
`XCTest` or `Testing`, or holds `@Test` or `@Suite`. The reason of a skipped test is the text
argument of `XCTSkip` or `.disabled`, and an empty one is the finding. `xcode/test-plan` moves to
`all`.

**What goes.** The folder name test, the depth constant, and the eight-character test.

**Tests.** Planted cases for two files of one name, a Swift Testing file outside `Tests`, and a
skip with an empty reason.

**Done when.** They pass, and the redo of the app reports orphans only for images whose test is
gone, checked by hand against ten of them.

## K-153: Python modules named from the repository root

**What is wrong.** `python/import-cycles` names `src/shop/orders.py` as `src.shop.orders`, and
imports say `shop.orders`. No import resolves, so the check finds no cycle in a `src/` layout or
in a scope.

**Target.** A module is named from the package roots the project declares.

**Files.** `readers/python-project.ts`, `structure/analyses/import/cycles.ts`.

**Logic.** The reader takes roots from `[tool.setuptools.packages.find] where`,
`[tool.hatch.build.targets.wheel] packages`, a `src/` folder, and then the scope root.

**What goes.** The path from the repository root as a module name.

**Tests.** `python.test.ts` plants a cycle under `src/` in a scope.

**Done when.** It reports the cycle.

## K-154: the static site checks build inside the working tree

**What is wrong.** The checks run the build command of the developer in the tree and write into
the real output folder, and `build-reproducible` runs it twice. A repository that tracks `dist`
has a changed tree after a check (D-99). The command is split at spaces, and the default is
`npm run build` in a repository that uses bun.

**Target.** The build writes into a folder of the cache, and the tree is unchanged.

**Files.** `checks/static-site/build.ts`, `run/scratch-copy.ts`, `run/command-parts.ts`.

**Logic.** The check copies the scope through `scratchCopy`, less the ignored files, and builds
there. The command is the `build` script run through the package manager `nypm` detects. A
command from a setting is parsed with shell quoting rules, by one function in
`command-parts.ts`.

**What goes.** The split at spaces, and the default `npm run build`.

**Tests.** A planted site that tracks `dist` holds a clean `git status` after
`gspot check --stage push`.

**Done when.** That case passes.

## K-160: every SQL file is parsed as Postgres

**What is wrong.** `POSTGRES_DIALECTS` in `sql/checks.ts` holds `postgres` and `ansi`, and `ansi`
is the default. A repository of MySQL files that names no dialect gets Postgres syntax errors.

**Target.** `sql/syntax` runs where the dialect is `postgres`. `init` proposes the dialect from
what it finds.

**Files.** `checks/sql/syntax.ts`, `presets/language/sql/manifest.toml`.

**Logic.** The setting `tools.sql.dialect` takes a `detect` table (K-93): a `supabase/` folder or
`pg` in the dependencies gives `postgres`, `mysql2` gives `mysql`, and `better-sqlite3` gives
`sqlite`. The check declares `waits_for` that setting with the value `postgres`.

**What goes.** `ansi` in the list.

**Tests.** A planted MySQL file with a backtick name holds no finding.

**Done when.** It passes.

## K-184: a `.dockerignore` beside every Dockerfile

**What is wrong.** `docker/ignore-file` asks for the file beside each Dockerfile. Docker reads it
from the root of the build context, or from `<name>.dockerignore` beside the Dockerfile.

**Target.** The check accepts the places Docker reads.

**Files.** `checks/docker/ignore-file.ts`.

**Logic.** Three candidates: the folder of the Dockerfile, `<name>.dockerignore` beside it, and
the scope root.

**What goes.** Nothing.

**Tests.** A planted `docker/Dockerfile` with the ignore file at the root holds no finding.

**Done when.** It passes.

## K-191: plugin rule defaults that are folders of one repository

**What is wrong.** `src/env/**` and `config/**` own the environment, `tests/harness` holds test
support, `**/features/*/server/**` is a server file, and `tests/vitest` is excluded by name.

**Target.** A default names no folder. A rule with nothing passed reports nothing.

**Files.** `env-access-owner.ts`, `tests-directory-contents.ts`, `require-server-only.ts` of the
plugin, and the javascript and nextjs templates.

**Logic.** The template passes `tools.eslint.env_files`, `tools.vitest.harness_directory`, and
`tools.next.server_files`, each with an empty default and a `detect` table where a convention of
the framework exists.

**What goes.** `DEFAULT_ROLES` and four folder lists.

**Tests.** Each rule test gains a case with no option, which expects no report.

**Done when.** They pass.
