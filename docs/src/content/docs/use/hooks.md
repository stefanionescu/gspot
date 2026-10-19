---
title: Git hooks
description: Run checks before commits and pushes and check commit messages.
---

The `gspot init` plan includes Git hooks. With `hooks.enabled = true`, gspot writes each hook below that runs at least one check, and `gspot install` turns them on. At level `recommended`, no check runs on commit messages, so gspot writes no `commit-msg` hook.

| Hook         | Checks                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | The commit-stage checks, on the staged files.                                                                                                              |
| `pre-push`   | The commit- and push-stage checks, on each commit that the push sends. At level `all`, `commits/commitlint-pushed` also checks each pushed commit message. |
| `commit-msg` | The message-stage checks on the new commit message: `commits/commitlint`, at level `all`.                                                                  |

The commit hook checks the staged files. The push hook checks every commit that it pushes, intermediate ones included. Some checks, such as the type checker, read the whole project and can report a finding in a file you did not change.

Each clone runs `gspot install` once to turn the hooks on; see [Set up a clone](/start/install/#set-up-a-clone).

## Turn hooks on or off

To turn hooks on, run:

```shell
gspot set hooks.enabled true
gspot install
```

To turn them off, run `gspot set hooks.enabled false`, then `gspot install`.

## Existing hook managers

A repository with Husky, Lefthook, or your own hook folder keeps its hooks. gspot prints one line for each hook instead; add each line to the matching hook. For npm, the lines look like this:

```shell
# pre-commit
npm exec --no -- gspot check --hook pre-commit
# pre-push: preserve Git's remote arguments and standard input
npm exec --no -- gspot check --hook pre-push -- "$@"
# commit-msg: preserve Git's message-file argument
npm exec --no -- gspot check --hook commit-msg -- "$1"
```

Use the exact lines that gspot prints for your package manager or mise. A hook without its line runs no gspot checks.

The lines start gspot this way:

```text
npm: npm exec --no -- gspot
pnpm: pnpm exec gspot
Yarn: yarn exec gspot
Bun: bun run --no-install gspot
```

When the root `package.json` does not list `@gspothq/cli`, they run `mise exec -- gspot`.

## Test a hook

```shell
gspot check --hook pre-commit
gspot check --hook commit-msg -- .git/COMMIT_EDITMSG
```

The pre-push hook needs the remote arguments and revision updates that Git passes on standard input, so test it with `git push`. After a failed push, the `run again:` line of the report runs the pre-push checks again with the input of Git. To compare with a branch outside a push:

```shell
gspot check --changed origin/main
```

## Large files

When `.gitattributes` sends files through the `lfs` filter of Git Large File Storage (LFS), gspot writes the `pre-push`, `post-checkout`, `post-commit`, and `post-merge` hooks. When your `PATH` holds `git-lfs`, each one runs `git lfs` first, then the gspot checks of that hook. gspot replaces the stock hooks that `git lfs install` writes, so LFS needs no other hook manager.

## When a hook fails

Fix each finding, then commit or push again. To stop a finding on every run, add an ignore with a reason. See [Ignore findings](/use/ignore/).
