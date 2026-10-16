---
title: Git hooks
description: Run checks before commits and pushes and check commit messages.
---

`gspot init` proposes Git hooks. With `hooks.enabled = true`, gspot writes three hooks and `gspot install` turns them on:

| Hook         | Checks                                               |
| ------------ | ---------------------------------------------------- |
| `pre-commit` | Commit-stage checks over staged files                |
| `pre-push`   | Push-stage checks over every pushed revision         |
| `commit-msg` | Message-stage checks; commitlint runs at level `all` |

At level `recommended`, no check reads commit messages, so the commit-msg hook finds nothing. Level `all` adds the commit message check: `commits/commitlint`.

The commit hook reads staged files. The push hook covers the commits Git pushes, including intermediate commits. Some checks, such as the type checker, read the whole project. They can report a problem in a file you did not change.

## After you clone

`gspot install` points Git at the hooks in your copy; see [Join a repository](/guides/join/).

A repository with Husky, Lefthook, or a hook folder you wrote retains its existing hooks. gspot prints all three gspot hook lines. Add each line to the matching hook. For npm, the lines have this form:

```shell
# pre-commit
npm exec --no -- gspot check --hook pre-commit
# pre-push: preserve Git's remote arguments and standard input
npm exec --no -- gspot check --hook pre-push -- "$@"
# commit-msg: preserve Git's message-file argument
npm exec --no -- gspot check --message-file "$1"
```

Use the exact lines printed by your installation for its package manager or mise. A missing integration line leaves that hook's checks inactive.

## Check hooks

```shell
gspot check --hook pre-commit
gspot check --message-file .git/COMMIT_EDITMSG
```

The pre-push hook requires Git's remote arguments and revision updates on standard input. Use `git push` to exercise that protocol. For a branch comparison outside a push:

```shell
gspot check --base origin/main
```

To turn hooks on, run:

```shell
gspot set hooks.enabled true
gspot install
```

`git commit --no-verify` and `git push --no-verify` bypass the local hooks once. CI still runs. To stop a finding for good, add an ignore. See [Ignore a finding](/guides/exclude/#ignore-a-finding).

Checks at the manual stage run only when named with `--only`, for example `gspot check --only security/semgrep-registry`. See [CI](/guides/ci/) for pipeline setup.

## Turn hooks off

Run `gspot set hooks.enabled false`, then `gspot install`.
