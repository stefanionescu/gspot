---
title: Git hooks
description: Run checks before commits and pushes and check commit messages.
---

The `gspot init` plan includes Git hooks. With `hooks.enabled = true`, gspot writes each hook below that runs at least
one check, and `gspot install` turns them on. Hooks run code from the repository; see [Trust](/start/concepts/#trust).

| Hook         | Checks                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | The commit-stage checks, on the staged files.                                                                                                                            |
| `pre-push`   | The push-stage checks, on the files the push changes, as they are in the pushed tip. At level `all`, `commits/commitlint-pushed` also checks each pushed commit message. |
| `commit-msg` | The message-stage checks on the new commit message: `commits/references`, and at level `all` also `commits/commitlint` and `prose/commit-message`.                       |

```mermaid
flowchart LR
    accTitle: What the hooks check
    accDescr: git commit runs the commit checks in the pre-commit hook, then the message checks in the commit-msg hook, and a failed check stops the commit. git push runs the push checks in the pre-push hook, and a failed check stops the push.
    commit["git commit"] --> precommit["pre-commit hook: commit checks on the staged files"]
    precommit -- passed --> message["commit-msg hook: message checks"] -- passed --> committed["commit"]
    precommit -- failed --> stopped["no commit"]
    message -- failed --> stopped
    push["git push"] --> prepush["pre-push hook: push checks on the pushed tips"]
    prepush -- passed --> pushed["push"]
    prepush -- failed --> refused["no push"]
```

The push hook checks the tip of each pushed branch, so a mistake that a later commit of the same push fixes does not
fail it. The commit hook already checked each commit, so the push hook leaves out the commit checks; CI runs both
stages. Checks that read the whole project, such as the type checker, report findings in files that you did not change.

A hook that cannot start gspot stops the commit; see
[Troubleshooting](/use/troubleshooting/#a-hook-cannot-find-npm-pnpm-yarn-bun-or-mise).

When dependency files differ, gspot prints: "The dependency files in the working tree differ from the checked revision;
the checks used the installed dependencies."

## Turn hooks on or off

To turn hooks on, run:

```shell
gspot set hooks.enabled true
gspot install
```

To turn them off, run `gspot set hooks.enabled false`. It removes `.gspot/hooks` and unsets `core.hooksPath`.

## Existing hook managers

A repository with Husky, Lefthook, or your own hook folder keeps its hooks. A `.husky` folder counts only while
`core.hooksPath` points into it, as Husky sets it. gspot prints one line for each hook instead; add each line to the
matching hook:

```shell
# pre-commit
.gspot/hooks/pre-commit "$@"
# pre-push
.gspot/hooks/pre-push "$@"
# commit-msg
.gspot/hooks/commit-msg "$@"
```

Use the exact lines that gspot prints. A hook without its line runs no gspot checks.

## Test a hook

```shell
gspot check --staged --stage commit
gspot check --hook commit-msg -- .git/COMMIT_EDITMSG
```

The pre-push hook needs the remote arguments and revision updates that Git passes on standard input, so test it with
`git push`. After a failed push, the `rerun:` line checks the files changed after the remote hash with
`gspot check --only <check> --base <hash>`. To compare with a branch outside a push:

```shell
gspot check --base origin/main
```

## Large files

When a tracked file has the Git attribute `filter=lfs`, gspot writes the `pre-push`, `post-checkout`, `post-commit`,
and `post-merge` hooks for Git Large File Storage (LFS). An unused attribute pattern does not enable these hooks.
The `pre-push` hook runs its gspot checks before `git lfs pre-push`, so a push that the checks refuse uploads no
LFS object. If `PATH` lacks `git-lfs`, the hook exits with code 2 before any checks run and asks you to install it. gspot replaces the stock hooks that `git lfs install` writes, so LFS
needs no other hook manager.

## When a hook fails

Fix each finding, then commit or push again. To stop a finding on every run, add an ignore with a reason. See [Ignore
findings](/use/ignore/).
