# The First Fixes

These rows give a wrong answer, lose a file of the developer, or stop every run. They close
before any design work. Each fix gets a planted test, because most of these defects lived
where no test looked. The [CI evidence](../13-roadmap.md#ci-repair) records the completed repair.

The order inside the step: the four rows that destroy work first (K-36, K-156,
K-159, K-257). Then the rows where a check passes on work it never did (K-140, K-157, K-254, K-258).
Then the rest, in the order below. K-47 sits in [00-delete-first.md](00-delete-first.md).

The static-site reproducibility check runs its second build in a scratch copy. It preserves
its first output for concurrent readers and reports a failed second build as an error.
Regression tests cover both behaviors. The first build still runs in the working tree, and
full scratch-path confinement and recovery remain open under K-298 and K-299.

## K-36: takeover deletes a file two tools read

**What is wrong.** `config/patterns.ts:164` lists `setup.cfg` and `tox.ini` as sqlfluff files.
`deleteReplaced` in `lifecycle/takeover.ts:137` removes them when the sql preset is selected,
with flake8, pytest, and tox settings inside.

**Target.** Takeover deletes a file only when one tool owns it (D-109). A shared file is read,
its section is carried, and the plan names the section for the developer to remove.

**Files.** `presets/sql/manifest.toml` gains its takeover rows (K-14). `config/patterns.ts` loses
the tool file table in row 13. `lifecycle/takeover.ts`.

**Logic.** A takeover row of a manifest has `file` and `shared = true` or no such key.
`deleteReplaced` skips a shared row, and `noLongerRuns` prints its section name.

**What goes.** The two names in the sqlfluff list today.

**Tests.** `takeover.test.ts` plants a `setup.cfg` with `[flake8]` and `[sqlfluff]`, and holds
that the file is there after `init --yes`.

**Done when.** No shared file name appears in a takeover row without `shared = true`, by a unit
test over the manifests. The list of shared names is `setup.cfg`, `tox.ini`, `pyproject.toml`, and
`package.json`. `.editorconfig` is taken over like a Prettier file (K-270).

## K-156: a check deletes untracked SQL files

Closes K-156 and K-159.

**What is wrong.** `drizzleMigrations` in `web/library-checks.ts:128` runs `drizzle-kit generate`
in the working tree, then removes every untracked `.sql` file of the scope with `git clean`
(line 137). A migration written by hand is deleted. `openapiFresh` in `express/openapi.ts:71`
runs `git checkout --` on the OpenAPI document, which drops uncommitted edits.

**Target.** A check never writes into the tree, never runs `git clean`, and never runs
`git checkout`.

**Files.** `checks/drizzle/migrations-fresh.ts` and `checks/express/openapi-fresh.ts`, as
[16-file-tree.md](../16-file-tree.md) names them, and `run/scratch-copy.ts`. That file takes
`scratchCopy` out of `run/fixers.ts:57`, where `--dry-run` already uses it.

**Logic.** `scratchCopy(input, paths)` copies the named paths into `.gspot/cache/scratch/<check>/`
and returns that folder. The drizzle check copies the schema, the config, and the migrations
folder, runs `generate` there, and compares the two folders. The OpenAPI check runs its command
with the output path inside the scratch folder, and compares the text.

**What goes.** `untrackedSqlFiles`, the `git clean` call, and the `git checkout` call. The
Cloudflare and Next.js types checks move to `scratchCopy` too, so one form exists.

**Tests.** A planted drizzle repository with an untracked `0009_manual.sql` holds that the file
exists after `gspot check --stage push`. The same for an edited, uncommitted `openapi.json`.

**Done when.** A search of `src/` for `'clean'` and `'checkout'` as git arguments finds nothing.

## K-257: a full disk cuts the policy in half

Closes K-257 and K-252.

**What is wrong.** On a full disk `gspot ignore` left `gspot.toml` cut in the middle of a string,
and every later command refused it. `gspot check` died with a stack trace at `writeCached`
(`run/cache.ts:71`). With a read-only `.gspot/`, `writeRecord` (`run/record/write.ts:28`) throws
after every check ran, and the verdict is lost.

**Target.** A file gspot writes is whole or untouched. A run whose cache or report cannot be
written still prints its findings and keeps its exit code.

**Files.** New `emit/atomic-write.ts`. Callers: `policy/write.ts`, `emit/apply-command.ts`,
`emit/managed-blocks.ts`, `run/record/write.ts`, `run/cache.ts`.

**Logic.** `writeWhole(path, text)` writes `<path>.<pid>.tmp` in the same folder, then renames
it, and removes the temporary file when the write throws. `writeCached` and `writeRecord` catch
the error and print one line on stderr: the path and the system message. `execute.ts` sets the
exit code from the findings before it writes the record.

**What goes.** Every direct `writeFileSync` and `Bun.write` of `src/` outside `atomic-write.ts`,
held by an ESLint `no-restricted-syntax` selector in the `gspot.toml` of this repository.

**Tests.** A unit test makes the rename fail and holds that the old file is whole. A planted run
with a read-only `.gspot/` holds exit 1, the findings on stdout, and one line on stderr.

**Done when.** The two planted cases pass, and `grep writeFileSync packages/cli/src` names one
file.

**Partially implemented, September 20, 2026.** Cache and report write errors print one
stderr line through the output owner. Both clean and failing runs keep their established
findings and exit code. Both report formats are rendered before writing starts.

The storage,
report identity, and output suites pass locally with a real read-only directory fixture
(13 tests, 81 assertions). Atomic replacement, tracked-file writers, and the shared lifecycle
boundary remain open. Windows permission behavior remains platform verification deferred.

## K-140: three checks pass when ast-grep is absent

**What is wrong.** `astGrepMatches` in `structure/ast-grep.ts:26` returns an empty list when no
ast-grep is installed, so `structure/shell-branches`, `shell-nesting`, and
`shell-mutable-assignments` report `ok`. ast-grep also gets every file on one command line.

**Target.** A check whose tool is absent reports `missing`, as every tool check does.

**Files.** `structure/ast-grep.ts`, `structure/counts.ts`, `run/file-batches.ts`.

**Logic.** `astGrepMatches` returns `undefined` for an absent tool, and `counts.ts` turns that
into the `missing` status through `platform/missing-tool.ts`. The file list goes through
`fileBatches`, the batching every tool run uses.

**What goes.** The silent empty return.

**Tests.** A unit test runs the three checks with an empty `PATH` and holds `missing`.

**Done when.** That test passes.

## K-157: a check that is off reports ok

**What is wrong.** `nextjs/build`, `postgres/migration-docs`, `xctest/coverage`, and
`xcode/entitlements-policy` run nothing until a setting is set, and print `ok` with a file count.
The six checks of a built site return nothing when the site did not build.

**Target.** A check that waits for a setting reports `skipped` and names the setting.

**Files.** `presets/manifest-schema.ts`, `run/plan.ts`, `run/engines.ts`, and the manifests of
nextjs, postgres, xctest, xcode, and static-site.

**Logic.** A check in a manifest takes `waits_for = "<setting>"`. `plan.ts` marks the check
`skipped` with the note `set <setting> to turn this on` when the setting is unset, false, or
empty. A static-site check takes `requires = "build"`, which already exists, and a failed build
marks its six checks `skipped` with the note `the site did not build`.

**What goes.** The early return in each of the five check files.

**Tests.** A unit test over the manifests holds that every check that reads a setting with an
empty default declares `waits_for`. A planted Next.js repository holds the `skipped` line.

**Done when.** No check prints `ok` for work it did not do, held by those two tests.

## K-254: `bash -n` over files Bash cannot read

**What is wrong.** The bash manifest claims `.zsh` and `.bats`, and `bash/syntax` runs `bash -n`
on every claimed file. `bash -n` exits 2 on any bats test file.

**Target.** `bash/syntax` reads `.sh`, `.bash`, and files with a Bash shebang. `bash/zsh-syntax`
runs `zsh -n` over `.zsh` files, and `bash/bats-syntax` runs `bats --count` over `.bats` files.

**Files.** `presets/bash/manifest.toml`, and the bash preset page.

**Logic.** Three checks with three claims. `zsh` and `bats` are host tools, so an absent one
reports `missing` with its install hint. ShellCheck and shfmt keep skipping `.zsh`, which the
manifest already says.

**What goes.** `.zsh` and `.bats` leave the claim of `bash/syntax`.

**Tests.** `bash.test.ts` plants a valid bats file and a broken one, and holds one finding.

**Done when.** That case passes.

## K-258: the Compose check loses a word of its command

**What is wrong.** `plainPart` in `run/tool-runner.ts:86` drops `{file}` from the built command.
`perFileCommands` (line 148) then cuts the built command at the index of the unbuilt one, so
`docker compose -f <file> config --quiet` runs without `config`. A file with `env_file: .env`
also fails on every clone.

**Target.** `{file}` is replaced where it stands, in any position.

**Files.** New `run/command-parts.ts`, which takes `plainPart`, `perFileCommands`, and
`run/list-arguments.ts`. `presets/docker/manifest.toml`.

**Logic.** `plainPart` returns a marker object for `{file}`, and `perFileCommands` maps each
built command by replacing the marker. The manifest command gains `--no-env-resolution`.

**What goes.** The index arithmetic over two arrays of different length.

**Tests.** A unit test builds a command with `{file}` first, in the middle, and last. The docker
planted repository holds a Compose file with `env_file`, a good one, and one with a bad key
(T-28).

**Done when.** `docker/compose-config` passes on the good file and fails on the bad key.

## K-37: a folder named hooks

**What is wrong.** `HOOK_DIRECTORIES` in `config/patterns.ts:211` holds the bare name `hooks`, so
a source folder of React hooks reads as git hooks (A-3).

**Target.** A hooks folder is `.githooks`, `.husky`, `.git-hooks`, or what `core.hooksPath`
names.

**Files.** `config/patterns.ts`, `repository/existing-tooling.ts`.

**Logic.** The name leaves the list. `existing-tooling.ts` reads `git config core.hooksPath`
first, and that answer wins over any folder name.

**What goes.** One list entry.

**Tests.** `takeover.test.ts` plants `hooks/use-thing.ts` and holds that the plan names no hooks.

**Done when.** That case passes.

## K-45: the message run overwrites the report

**What is wrong.** `writeRecord` runs after every run, the `commit-msg` run included. After one
commit the report of the last full run is gone, and `gspot doctor` cannot say when that run was.

**Target.** A run of the `message` stage writes no report (D-105).

**Files.** `run/execute.ts`, `run/record/write.ts`.

**Logic.** `execute.ts` calls `writeRecord` only for a stage other than `message`.

**What goes.** Nothing.

**Tests.** `hooks.test.ts` commits, then holds that the report still names the earlier run.

**Done when.** That case passes.

## K-61: the rules lint folder

**What is wrong.** `packages/cli/rules-lint` and the alias `#rules-lint/*` sit outside `src/`,
beside a `src/rules/` folder that holds the other half of the same subject.

**Target.** One folder, `src/rules/`, with `lint.ts`, `front-matter.ts`, `terms.ts`,
`examples.ts`, and `lint-command.ts`.

**Files.** The move of [00-delete-first.md](00-delete-first.md) (S-10) does this. This row adds
the alias change: `packages/cli/package.json` and `tsconfig.json` lose `#rules-lint/*`.

**Logic.** Imports use `#cli/rules/*`.

**What goes.** The alias, and `tests/unit/rules-lint/`, which becomes `tests/unit/rules/`.

**Tests.** The existing unit tests, moved.

**Done when.** A search for `rules-lint` finds nothing.

## K-108: a missing `[hooks]` table

**What is wrong.** `normalizeScalars` (`policy/normalize.ts:76`) fills a missing `[hooks]` table
with `tool = "gspot"`, so `apply` points `core.hooksPath` at `.gspot/hooks`. A missing `[ci]` or
`[runner]` table means nothing is written.

**Target.** A missing table means gspot does nothing there, for all three (D-130).

**Files.** `policy/normalize.ts`, `policy/schema.ts`, `emit/hooks.ts`.

**Logic.** `Policy['hooks']` is optional. `init` writes the table it chose, so a config written
by `init` is explicit. The value `"none"` leaves the three enums.

**What goes.** Three defaults and three `"none"` values.

**Tests.** A unit test holds that `apply` on a config with no `[hooks]` table leaves
`core.hooksPath` unset.

**Done when.** That test passes.

## K-109: gspot replaces a script of the developer

**What is wrong.** `npmScripts` (`emit/runner-surface.ts:132`) returns `check`, `check:fix`,
`apply`, and `prepare`, and `writePackages` overwrites a script of the same name. `prepare` often
holds husky or a build. `uninstall` cannot bring the old value back.

**Target.** gspot writes a script only where the name is free, and never writes `prepare`. Where
`lint`, `format`, or `check` exists, the plan proposes a new body and the developer accepts it
(D-116). The developer runs `gspot install` explicitly; no setup or lifecycle script is injected (D-115).

**Files.** `emit/runner-tasks.ts`, `emit/apply-command.ts`, `lifecycle/init/plan.ts`.

**Logic.** `writePackages` takes the accepted names from the policy, `[runner] tasks`. A name
that exists and was not accepted is skipped and printed.

**What goes.** The `prepare` script, and with D-145 every `devDependencies` write but the
launcher.

**Tests.** A planted install with `"prepare": "husky"` holds that the line is unchanged.

**Done when.** That case passes.

## K-114: `gspot-ignore` works for four id prefixes only

**What is wrong.** `ENGINE_PREFIXES` in `run/ignores.ts:11` tests the check name. Checks named
`swift/...`, `python/...`, `xctest/...`, `postgres/...`, and `docs/...` run on the same engines,
and the comment does nothing there.

**Target.** The comment works for every check an engine of gspot runs.

**Files.** `run/ignores.ts`, `types/run.ts`.

**Logic.** A finding carries `engine`, set by `runEngineCheck`. The filter reads that field.

**What goes.** `ENGINE_PREFIXES`.

**Tests.** A planted Swift file with `// gspot-ignore swift/... -- reason` holds no finding.

**Done when.** That case passes.

## K-134: strict mode asks for an option Bash 3.2 lacks

**What is wrong.** `STRICT_MODE` in `config/shell.ts:51` requires `shopt -s inherit_errexit` in
every executable script. The option needs Bash 4.4, and the same check accepts a header that
declares Bash 3.2.

**Target.** The option is required where the header declares Bash 4.4 and up. It is a finding of
`shell-interpreter` where the header declares an older Bash.

**Files.** `config/shell.ts`, `structure/analyses/shell/interpreter.ts`, `rules/language/BASH.md`.

**Logic.** `BASH_FOUR_FEATURES` gains the option. `STRICT_MODE` holds `set -euo pipefail` alone,
and a second constant holds what Bash 4.4 adds.

**What goes.** Nothing.

**Tests.** Two planted scripts, one for each header, each valid under its own rule.

**Done when.** Both pass.

## K-147: one wrong line stops every command

**What is wrong.** `parsePolicyText` (`policy/read-policy.ts:57`) throws on the first problem, and
`openSession` lets it stop `check` and the commit hook. A mistyped setting blocks every commit.

**Target.** `check` runs with the rest of the config and reports the wrong line as a finding of
`integrity/policy`. The finding carries the file and the line. A TOML syntax error still stops the run, because no rest
exists.

**Files.** `policy/read-policy.ts`, `policy/problems.ts`, `run/session.ts`, new
`checks/integrity/policy.ts`.

**Logic.** `readPolicy` returns the policy and its problems. A problem drops its own entry or key
and keeps the others. The edit commands and `apply` still refuse a config with problems, because
they write from it.

**What goes.** `Session.problems` as an always-empty field (K-104) becomes the real list.

**Tests.** A planted config with an `[[ignore]]` that lacks a reason holds one finding, and the
other checks run.

**Done when.** That case passes.

## K-172: a route is tested when a comment names it

**What is wrong.** `express/routes.ts` passes a route when any test file holds the file stem
anywhere in its text, and it reads every file of the repository.

**Target.** A route counts as tested when a test file of the same scope imports it.

**Files.** `checks/express/routes-tested.ts`, `structure/cross-file-index.ts`.

**Logic.** The check asks the import index of the scope, which the structure engine builds, for
the importers of the route file, and keeps those the test claim matches.

**What goes.** The text search.

**Tests.** `express.test.ts` plants `users.ts` and a test that names `users` in a comment, and
holds the finding.

**Done when.** That case passes.

## K-178: a statement is reported at the line of its comment

The level of `sql/block-comments` changes with K-161, in [07-levels.md](07-levels.md).

**What is wrong.** `firstKeyword` in `sql/statements.ts` skips line comments and blank lines, and
not block comments.

**Target.** The SQL reader knows block comments once, and every SQL check gets the line of the
statement.

**Files.** `readers/sql/statements.ts`.

**Logic.** The reader takes statement positions from `libpg-query`, which already skips both
comment forms, and drops its own scan.

**What goes.** `firstKeyword`.

**Tests.** A unit test with a block comment above `DROP TABLE` holds the line of `DROP`.

**Done when.** That test passes.

## K-181: the manifest key `needs` is dropped by the loader

**What is wrong.** `toConfiguration` in `presets/read-manifests.ts` copies a config key by key and
leaves `needs` out, so `isWanted` in `emit/targets.ts` never sees it. The cloudflare preset then
writes a Semgrep pack with no security preset to read it.

**Target.** The loader passes the parsed config on whole.

**Files.** `presets/read-manifests.ts`, `types/manifest.ts`.

**Logic.** `toConfiguration` returns the zod output, and the type is inferred from the schema.

**What goes.** The copy by hand, and the hand-written `Configuration` type.

**Tests.** A planted Cloudflare repository without the security preset holds no
`.gspot/semgrep/workers.yml`.

**Done when.** That case passes.

## K-186: `no-trivial-files` reports every entry file

**What is wrong.** A `main.ts` that imports `start` and calls it is the invalid case of the
rule's own test, and the template turns the rule off one list at a time.

**Target.** The rule skips the entry files of `tools.knip.entry`, the one list of entries gspot
keeps.

**Files.** `packages/eslint-plugin/src/rules/no-trivial-files.ts`, its test, and
`presets/javascript/eslint.config.js.tmpl`.

**Logic.** The rule takes an `entryFiles` option, and the template passes the setting.

**What goes.** The per-framework off lists of the template for this rule.

**Tests.** The rule test moves `main.ts` to the valid cases (T-20).

**Done when.** A planted Vite app has no such finding.

## K-189: `no-cross-folder-imports` reports every `../`

**What is wrong.** The rule reports any import that starts with `../`, also one inside a feature
folder, and asks for an alias that a repository without `paths` does not have.

**Target.** The rule reports an import whose target leaves the top-level folder of the importer.

**Files.** `packages/eslint-plugin/src/rules/no-cross-folder-imports.ts` and its test.

**Logic.** The rule resolves the import against the file, takes the first segment under the
source root for both paths, and compares. The message names the alias only where one exists.

**What goes.** The prefix test.

**Tests.** Valid: `features/cart/a.ts` imports `../cart/b`. Invalid: it imports `../user/b`.

**Done when.** Both cases pass.

## K-192: a protocol name fails the case check

**What is wrong.** `isExempt` in `naming/match.ts` skips the banned term check alone, so
`Retry-After` in a headers object is a case finding, and the unit test expects it.

**Target.** A name the repository cannot change is exempt from every name check.

**Files.** `naming/validate-name.ts`, `naming/match.ts`, and
`tests/unit/naming/validate-name.test.ts`.

**Logic.** `nameProblems` returns early for a name in `naming.contract_properties`,
`naming.external`, or `naming.allowed`.

**What goes.** The test expectation of the finding (T-20).

**Tests.** The unit test holds no finding for `Content-Type`.

**Done when.** That test passes.

## K-206: two pins their npm package never had

**What is wrong.** A manifest holds one `version` for every installer. taplo 0.10.0 and
editorconfig-checker 3.4.0 are binary versions, and the npm packages number by themselves.

**Target.** An installer that numbers differently carries its own version.

**Files.** `presets/manifest-schema.ts` (`toolSchema`), the config-files and formatting manifests,
and `tests/release/`.

**Logic.** An installer value is a name, or a table with `name` and `version`. A release test
asks npm, PyPI, crates.io, and GitHub for every pin. It runs with the release suite, because it
calls the network.

**What goes.** Nothing.

**Tests.** That release test.

**Done when.** It passes for all pins.

## K-226: `tsc -p` reads nothing in a project with references

**What is wrong.** `typescript/tsc` runs `tsc --noEmit -p tsconfig.json`. A solution file with
`references` and no `files` checks nothing and exits 0.

**Target.** The check builds the references where the file holds any.

**Files.** `presets/typescript/manifest.toml`, new `checks/typescript/tsc.ts`.

**Logic.** The check reads `tsconfig.json` through `jsonc-parser`. With references it runs
`tsc -b --noEmit`, and without it runs `tsc --noEmit -p`.

**What goes.** The fixed command in the manifest.

**Tests.** A planted repository with two referenced projects and a type error holds the finding.

**Done when.** That case passes.

## K-229: list items cut in mid-sentence

**What is wrong.** `PYTHON.md` (lines 669 to 707), `BASH.md` (lines 654 to 670), `SUPABASE.md`,
and the review list of `DOCKER.md` hold items that stop with no sentence end (K-262).

**Target.** Every list item of a rule file is a whole sentence.

**Files.** The four rule files, and `src/rules/lint.ts`.

**Logic.** The items are written whole from the reference repositories, which are read and not
changed. `lint.ts` reports a list item whose last line ends with a comma, with `and`, or with no full stop.

**What goes.** Nothing.

**Tests.** A unit test of the lint with one cut item.

**Done when.** `rules/lint` passes on `rules/` with the new finding on.

## K-234: the suppressions check is blind in four languages

Closes K-234 and K-110.

**What is wrong.** `SUPPRESSION_FORMS` in `config/integrity.ts` holds the comment forms of some
tools, and `integrity/suppressions.ts` reads `#` and `//` comments. A `-- noqa` in SQL, a
`stylelint-disable` in CSS, and an HTML or Markdown comment are never seen.

**Target.** Each manifest declares the suppression comment of its tool, and the check reads every
comment style.

**Files.** `presets/manifest-schema.ts`, the manifests of every preset with a tool that has such
a comment, `checks/integrity/suppressions.ts`, `config/suppressions.ts`.

**Logic.** A tool in a manifest takes `suppression = { marker, reason }`. The check takes the
comment styles from `config/markers.ts` and the markers from the selected manifests.

**What goes.** `SUPPRESSION_FORMS`.

**Tests.** Planted files in SQL, CSS, HTML, and Markdown, each with a bare suppression.

**Done when.** The four cases fail the check.

## K-238: values are interpolated without destination escaping

**What is wrong.** Reasons reach comments and JavaScript; paths reach TOML strings. A printable path such as `docs/"draft"/**` already breaks the typos template. Rejecting control characters alone does not fix this.

**Target.** Every emitted string, key, path, and comment uses destination-appropriate serialization under [03-configuration.md](../03-configuration.md).

**Files.** `policy/schema.ts`, `policy/messages.ts`, `emit/templates.ts`, and every affected preset template, including `presets/spelling/typos.toml.tmpl`.

**Logic.** Validate the semantic value, then encode it for TOML, JSON, JavaScript, shell arguments, or the relevant comment grammar. Use format writers where available. Never interpolate raw values into executable source or rely on a shared printable-text validator as escaping. Profiles use the same validators and writers.

**What goes.** Raw interpolation and the claim that no template needs escaping.

**Tests.** Parse every generated format after inputs containing quotes, backslashes, comment delimiters, Unicode, and rejected controls. Assert the parsed value equals the intended value and no additional setting or statement appears. Run the same cases through a profile.

**Done when.** Each output parses and round-trips, including the printable typos path.

## K-241: nine contradictions between rule files and checks

**What is wrong.** Rule files say one thing and a pinned linter or a decision says another. One
example: `SWIFT.md` forbids an explicit `internal`, and `swiftlint.yml.tmpl` turns on
`explicit_acl`. The row lists all nine.

**Target.** A rule file never asks for what a check of the same preset refuses.

**Files.** `rules/language/SWIFT.md`, `rules/general/agent/SUPPRESSIONS.md`, `GIT.md`,
`rules/general/code/COMMENTS.md`, `NAMING.md`, `NAMING-FILES.md`, `LOGGING.md`, and
`presets/swift/swiftlint.yml.tmpl`.

**Logic.** Each of the nine is settled on the side of the decision or the check, and the rule
file changes. `explicit_acl` moves to the level `all` (row 11), and the rule file says so.

**What goes.** Nine sentences.

**Tests.** `src/rules/lint.ts` reads every rule name a rule file names, and fails where the template
of its preset turns that rule the other way.

**Done when.** That lint passes.

## K-246: a check that no preset ships

**What is wrong.** `integrity/generated-drift` has code and no manifest. `integrity/generated-fresh`
is named in five documents and has no code. The CI job runs `gspot apply` to find drift.

**Target.** `integrity/generated-drift` ships in the structure preset at the commit stage. The
name `generated-fresh` leaves every document (D-134).

**Files.** `presets/structure/manifest.toml`, `checks/integrity/generated-drift.ts` (from
`emit/drift.ts`), `emit/workflow.ts`.

**Logic.** The workflow runs `gspot check`, and the drift check fails a generated file that
differs from what the policy writes.

**What goes.** `apply --check`, and the `gspot apply` step of the workflow.

**Tests.** A planted repository with an edited file under `.gspot/` holds the finding.

**Done when.** That case passes.

## K-250: libraries the documents name and nothing installs

**What is wrong.** A license expression is cut at brackets, `OR`, and `AND` by hand in
`integrity/licenses.ts` (`EXPRESSION_PARTS`), and `MIT OR (GPL-3.0-only AND ...)` is refused.
Markdown headings are read by a line pattern, so a `#` inside a code fence is a heading.

**Target.** `spdx-expression-parse`, `spdx-satisfies`, `mdast-util-from-markdown`, and `postcss`
are dependencies and do their job.

**Files.** `packages/cli/package.json`, `checks/licenses/npm.ts`, `checks/docs/headings.ts`,
`checks/docs/stale-paths.ts`, `checks/css/usage.ts`.

**Logic.** The license check calls `spdx-satisfies`. The docs checks walk the mdast tree.

**What goes.** `EXPRESSION_PARTS`, `HEADING`, and the five libraries that leave the table of
[12-repository-layout.md](../12-repository-layout.md).

**Tests.** Unit tests for the mixed expression and for a fenced `#` line.

**Done when.** Both pass.

## K-251: two commands pass flags their tool lacks

**What is wrong.** The fixer of `config-files/dotenv` passes `--skip-updates`, which
dotenv-linter refuses. v8r has no `--config` and no `--format`, so it reads the root copy.

**Target.** Every flag of every manifest exists in the pinned tool.

**Files.** `presets/config-files/manifest.toml`, `presets/config-files/v8r.yml.tmpl`, and a new
contract test under `tests/release/`.

**Logic.** The fixer drops the flag. The v8r check sets `V8R_CONFIG_FILE` through a new manifest
key `env`, which `tool-runner.ts` passes to the spawn.

**What goes.** The two flags, and the root `.v8rrc.yml` (D-100).

**Tests.** The contract test runs `<tool> --help` for each pinned tool and holds each flag.

**Done when.** It passes for all manifests.

## K-253: the workflow gspot writes breaks the rule file gspot installs

**What is wrong.** `RUNNERS` in `emit/workflow.ts` holds `ubuntu-latest`, and the job has no
timeout and no concurrency group. `GITHUB-ACTIONS.md` asks for all three. `TASKS.md` names
`check` and `check:fix`, and gspot writes `gspot:check`.

**Target.** The workflow follows the rule file, and the task names follow D-116.

**Files.** `emit/workflow.ts`, the three workflows of gspot, `emit/runner-tasks.ts`.

**Logic.** `RUNNERS` holds `ubuntu-24.04`, `macos-15`, and `windows-2025`. The job gains
`timeout-minutes: 20` and a `concurrency` group on the ref. The task is `check` where the name is
free, and `gspot:check` where it is taken.

**What goes.** The `-latest` images.

**Tests.** The workflow snapshot (T-36), and `zizmor` over it in the planted repository.

**Done when.** `config-files/actions-security` passes on the written workflow.

## K-261: good examples that fail the checks beside them

**What is wrong.** The good Dockerfile of `DOCKER.md` fails `docker/hadolint` with DL3008. Nearly
every good example of the fastapi files blocks inside `async def`. `FASTAPI.md` shows `-> Any`,
and ruff selects ANN401. `zod/prefer-strict-object` and `zod/prefer-meta` are errors the guide
never asks for.

**Target.** An example marked good passes the linter of its preset.

**Files.** `rules/tool/docker/DOCKER.md`, `rules/framework/fastapi/`, `rules/library/zod/ZOD.md`,
`rules/library/zustand/ZUSTAND.md`, `presets/zod/eslint.fragment.js.tmpl`, new
`src/rules/examples.ts`.

**Logic.** `examples.ts` takes each fenced block under a line that starts with `Good`, writes it
to the cache, and runs the tool the manifest names for that language. The two zod rules move to
the level `all`.

**What goes.** The wrong examples.

**Tests.** `rules/lint` runs the examples at the push stage.

**Done when.** It passes on `rules/`.
