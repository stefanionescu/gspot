# Cache Keys and the Push

Row 19 of the build order. Two defects made a gate say no for a reason that was gone: a cached
failure that outlived its cause, and a push refused for files that were not pushed.

## K-69: a repository check is cached on less than it reads

**What is wrong.** `keyFor` in `run/execute.ts` caches a `[[check]]` on the files its `paths`
name, and its command reads more. `schema/generated` failed from the cache and passed with
`--no-cache`, and it blocked a push on September 19, 2026.

**Target.** A `[[check]]` is cached only when it names its inputs.

**Files.** `policy/schema.ts`, `run/plan.ts` (`fromRepoCheck`), `run/execute.ts`.

**Logic.** `paths` says when the check runs. A new key `inputs` says what it reads, and the cache
key holds the hashes of those files. A check with no `inputs` is never cached.

**What goes.** The use of `paths` as a cache key.

**Tests.** A planted `[[check]]` that reads a file outside its `paths` fails, is fixed, and
passes on the next run with the cache on.

**Done when.** It passes.

**Partial implementation, September 20, 2026.** Repository checks without declared cache
inputs execute on every run. The planted regression changes an input outside `paths` and
requires failure, success, and failure with caching enabled. This also prevents a cached
`docs/generated` failure from rejecting corrected generated output. Explicit `inputs` and
their schema, planning, and hashing remain open. K-69 is not complete.

## K-70: the push hook checks the working tree

**What is wrong.** `emit/hooks.ts` writes a pre-push hook that runs `gspot check` over the whole
tree. Uncommitted work in unrelated files refuses a push of clean commits.

**Target.** The hook verifies the exact committed trees being pushed. HEAD and uncommitted work
do not change the result. Whole-project findings follow D-168.

**Files.** `emit/hooks.ts`, `run/check-command.ts`, `repository/staged.ts`.

**Logic.** The dispatcher invokes internal `gspot check --push`, buffering all stdin ref rows.
Each supplies local and remote object IDs. Compare the actual endpoints and check a temporary
committed snapshot with matching config and dependency locks.

Follow [10-hooks-ci-runners.md](../10-hooks-ci-runners.md) for multiple refs, new refs, tags,
force pushes, deletion-only pushes, missing objects, and a local ref other than HEAD.
Never read working-tree bytes as proof of a pushed commit. Reuse installed dependencies only
when their lock and manifest identity matches.

**What goes.** The full run on push.

**Tests.** `hooks.test.ts` pushes a clean commit with a broken uncommitted file beside it, and
holds a passing push.

**Done when.** It passes.

## K-293: a whole-project check fails every push of an old repository

Closes K-293 and K-294.

**What is wrong.** With no baseline (D-165), a type checker, knip, and the import checks report
every old problem of a project on every push, whatever the push changed. The CI job ran
`gspot check --changed`, and on the default branch that compares the branch with itself. The
install under `.gspot/` named no package manager for a repository whose projects use different
ones.

**Target.** D-168. Changed paths select file-list tools and affected projects, never filter the findings of a whole-project tool. Existing project errors may block adoption; the plan must say so.

**Files.** `run/execute.ts`, `run/plan.ts`, `repository/staged.ts`, `output/reporter.ts`, `emit/workflow.ts`, `emit/gitlab.ts`, `lifecycle/install-tools.ts`.

**Logic.** Preserve deleted paths and both sides of renames for impact selection. Configuration, locks, and shared project references trigger dependent projects. Keep every whole-project finding, fileless finding, and failed tool status. Unknown impact selects the broader set.

CI uses event-specific base and target objects, including merge queues and zero-base fallback, from [10-hooks-ci-runners.md](../10-hooks-ci-runners.md). Managed tools use the package manager chosen by D-171 and immutable locks.

**What goes.** Findings filtered by reported file path, and bare upstream comparison in CI.

**Tests.** Changing an export in `a.ts` must fail on a new error in unchanged `b.ts`. Cover deleted exports, renames, config-only changes, dependency changes, fileless failures, missing tools, old project errors, and every CI event. A clean commit with broken uncommitted work passes when its committed snapshot is clean.

**Done when.** No regression is hidden solely because its reported file was unchanged; the documented adoption tradeoff is visible.

**Partially implemented, September 20, 2026.** Staged and reference-relative observations
retain deletions and both sides of renames. Failed observations report errors. Absent paths
conservatively select project checks in their scope even when no readable inputs remain.
Per-file tools receive only current files.

Real execution test data cover deleting the last
file from an existing scope directory and moving it to another scope. Both affected project
findings survive, and correction previews report restored paths without changing the source.

Local verification passes 56 run, Git observation, and planted repository tests with 397
assertions. TypeScript and lint checks also pass.

Reverse dependencies, exact committed snapshots, configuration-only impact, event-specific
CI bases, and package-manager selection remain open. These local test data do not establish
Windows or Linux platform acceptance during the CI bypass.

## K-295: two flags name one idea

**What is wrong.** `gspot check --changed` compares with the upstream branch. `--since <ref>`
does the same from another ref. A developer reads two flags and learns one thing.

**Target.** D-169. `--changed` takes an optional ref, written `--changed=<ref>`. `--since` is
gone, with no alias.

**Files.** `program.ts`, `run/check-command.ts`, `repository/changed.ts`, `emit/hooks.ts`,
`emit/workflow.ts`, `emit/gitlab.ts`.

**Logic.** The parser reads the value only after an equals sign, so `gspot check --changed api`
checks the folder `api`. With no value the ref is `@{upstream}`, then the default branch
(K-272). The push hook uses internal `--push`; CI uses explicit event-specific base and target snapshots. Missing upstream and default refs give a setup error instead of an empty successful run.

**What goes.** The option `--since`, its help text, and its branch in `check-command.ts`.

**Tests.** `check-command.test.ts` holds both forms, holds that `--changed api` reads `api` as a
path, and holds that `--since` is an unknown option with exit 2.

**Done when.** It passes, and no document or help text holds the word `--since`.

**Locally verified, partial implementation.** The CLI accepts `--changed=<ref>` and a bare
`--changed` followed by positional paths. It resolves the configured upstream first, then
remote default-branch references. No usable default produces an explicit-ref setup error.
A missing configured upstream remains an error rather than selecting another branch.

Text and JSON reports identify the working-tree comparison reference. Tests exercise actual
Git histories, working edits, path selection, missing refs, no-Git operation, and shallow
history guidance. Existing deletion and rename regressions remain active. Internal push
snapshots and event-specific CI selection remain open under K-293 and K-294.
