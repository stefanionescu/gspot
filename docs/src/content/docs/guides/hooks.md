---
title: Git hooks
description: Run checks before commits and pushes and check commit messages.
---

gspot installs three Git hooks when `hooks.enabled = true`:

| Hook         | Checks                                               |
| ------------ | ---------------------------------------------------- |
| `pre-commit` | Commit-stage checks over staged files                |
| `pre-push`   | Push-stage checks over every pushed revision         |
| `commit-msg` | Message-stage checks; commitlint runs at level `all` |

At level `recommended`, a message hook can have no applicable check. A skipped check does not count as passed.

The commit hook reads staged files. The push hook covers the commits Git is pushing, including intermediate commits. Whole-project checks run for affected scopes and can report a finding in another file of the same project.

## Prepare the clone

Run `gspot install` after cloning. It points Git at `.gspot/hooks/` when no other hook manager owns the hooks.

A repository with Husky, Lefthook, or an authored hook folder retains its existing hooks. gspot prints all three integration lines. Add each line to the matching hook. For an npm runner, the lines have this form:

```shell
# pre-commit
npm exec --no -- gspot check --hook pre-commit
# pre-push: preserve Git's remote arguments and standard input
npm exec --no -- gspot check --hook pre-push -- "$@"
# commit-msg: preserve Git's message-file argument
npm exec --no -- gspot check --hook commit-msg --message-file "$1"
```

Use the exact lines printed by your installation for its runner. A missing integration line leaves that hook's checks inactive.

## Check hooks

```shell
gspot check --hook pre-commit
gspot check --hook commit-msg --message-file .git/COMMIT_EDITMSG
```

The pre-push hook requires Git's remote arguments and revision updates on standard input. Use `git push` to exercise that protocol. For a branch comparison outside a push:

```shell
gspot check --changed --base origin/main
```

Changing hook coverage keeps the current enabled choice. To enable hooks and check the whole tree of each pushed revision:

```shell
gspot set hooks.enabled true
gspot set hooks.push_files all
```

`git commit --no-verify` and `git push --no-verify` bypass the local hooks once. CI still runs. To accept a finding in saved policy, [record an ignore](/guides/policy/#record-one-exception).

Checks at the manual stage run only when named with `--only`, for example `gspot check --only security/codeql`. See [CI](/guides/ci/) for pipeline setup.
