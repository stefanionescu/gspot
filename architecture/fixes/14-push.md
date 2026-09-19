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

## K-70: the push hook checks the working tree

**What is wrong.** `emit/hooks.ts` writes a pre-push hook that runs `gspot check` over the whole
tree. Uncommitted work in unrelated files refuses a push of clean commits.

**Target.** The hook checks the files of the commits being pushed, and nothing else.

**Files.** `emit/hooks.ts`, `run/check-command.ts`, `repository/staged.ts`.

**Logic.** Git gives the hook the local and the remote id on stdin. The hook passes them as
`gspot check --changed=<remote id>`, which reads the files that differ, in place. A first push has
a zero remote id, and the hook then takes the commits no remote branch holds (K-272). Where a
pushed file also has uncommitted changes, the output says so, as staged mode does. No worktree
and no stash: a second checkout has none of the installed dependencies a type checker needs.

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

**Target.** D-168. A run over changed files reports findings in those files alone, and one line
counts the rest. CI compares with the commit before the change.

**Files.** `run/execute.ts`, `output/reporter.ts`, `emit/workflow.ts`, `emit/gitlab.ts`,
`lifecycle/install-tools.ts`.

**Logic.** `execute.ts` knows the changed file list of a run with `--staged` or
`--changed`. After a whole-project check it keeps the findings whose file is on that list, and the
exit code comes from those. The reporter prints one line with the count of the others and the
command that shows them.

The GitHub job passes the base of the pull request, or the commit before
the push, as `--changed=<commit>`. The GitLab job passes `CI_MERGE_REQUEST_DIFF_BASE_SHA`, or
`CI_COMMIT_BEFORE_SHA`. The install under `.gspot/` takes the package manager of the root, then
of the first JavaScript project, then what D-171 names.

**What goes.** The bare `gspot check --changed` in both CI jobs.

**Tests.** A planted TypeScript project with an old type error in `a.ts` pushes a change to `b.ts`
and passes, with the one line about `a.ts`. A unit test of each CI file holds the `--changed=` value.

**Done when.** Both pass.

## K-295: two flags name one idea

**What is wrong.** `gspot check --changed` compares with the upstream branch. `--since <ref>`
does the same from another ref. A developer reads two flags and learns one thing.

**Target.** D-169. `--changed` takes an optional ref, written `--changed=<ref>`. `--since` is
gone, with no alias.

**Files.** `program.ts`, `run/check-command.ts`, `repository/changed.ts`, `emit/hooks.ts`,
`emit/workflow.ts`, `emit/gitlab.ts`.

**Logic.** The parser reads the value only after an equals sign, so `gspot check --changed api`
checks the folder `api`. With no value the ref is `@{upstream}`, then the default branch
(K-272). The push hook writes `--changed=<remote id>`, and both CI jobs write
`--changed=<base commit>`.

**What goes.** The option `--since`, its help text, and its branch in `check-command.ts`.

**Tests.** `check-command.test.ts` holds both forms, holds that `--changed api` reads `api` as a
path, and holds that `--since` is an unknown option with exit 2.

**Done when.** It passes, and no document or help text holds the word `--since`.
