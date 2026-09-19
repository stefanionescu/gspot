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

**What is wrong.** `emit/hooks.ts` writes a pre-push hook that runs `gspot check` over the tree.
Uncommitted work in unrelated files refuses a push of clean commits.

**Target.** The hook checks the commits being pushed.

**Files.** `emit/hooks.ts`, `run/check-command.ts`, new `run/pushed-tree.ts`.

**Logic.** The hook passes the local and remote ids git gives it on stdin. `pushed-tree.ts` adds
a detached `git worktree` of the local id under `buildFolder(root)`, links `.gspot/node_modules`
into it, runs the push stage there over the files that differ from the remote id, and removes the
worktree. With a clean tree it skips the worktree and checks in place.

**What goes.** Nothing.

**Tests.** `hooks.test.ts` pushes a clean commit with a broken uncommitted file beside it, and
holds a passing push.

**Done when.** It passes.
