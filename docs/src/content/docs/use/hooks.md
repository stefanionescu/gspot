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

## After you clone

`gspot install` points Git at the hooks in your copy; see [Set up a clone](/start/install/#set-up-a-clone).

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

## Check hooks

```shell
gspot check --hook pre-commit
gspot check --hook commit-msg -- .git/COMMIT_EDITMSG
```

The pre-push hook needs the remote arguments and revision updates that Git passes on standard input, so test it with `git push`. To compare with a branch outside a push:

```shell
gspot check --changed origin/main
```

To turn hooks on, run:

```shell
gspot set hooks.enabled true
gspot install
```

`git commit --no-verify` and `git push --no-verify` bypass the local hooks once. CI still runs. To stop a finding on every run, add an ignore. See [Ignore a finding](/use/ignore/).

Checks at the manual stage run only when named with `--only`, for example `gspot check --only security/semgrep-registry`. See [CI](/use/ci/) for pipeline setup.

## Turn hooks off

Run `gspot set hooks.enabled false`, then `gspot install`.

## How hooks start gspot

When the root `package.json` lists `@gspothq/cli`, the Git hooks start gspot through your package manager:

```text
npm: npm exec --no -- gspot
pnpm: pnpm exec gspot
Yarn: yarn exec gspot
Bun: bun run --no-install gspot
```

Otherwise, they run `mise exec -- gspot`.
