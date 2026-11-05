---
title: Git hooks
description: Run the checks before each commit and push, and check each commit message.
---

A Git hook is a script that Git runs at a set point, such as before a commit. `gspot init` writes the gspot hooks and
turns them on. While `hooks.enabled` is `true`, gspot writes each hook in this table that runs at least one check, and
`gspot install` turns the hooks on. The hooks run code from your repository, as [Trust](/start/concepts/#trust)
describes.

| Hook         | Checks                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | The `commit` checks, on the staged files.                                                                                                                                                          |
| `pre-push`   | The `push` checks, on the files that the push changes, as they are in the newest commit of each pushed branch. At level `all`, `commits/commitlint-pushed` also checks each pushed commit message. |
| `commit-msg` | The `message` checks, on the new commit message: `commits/references`, and at level `all` also `commits/commitlint` and `prose/commit-message`.                                                    |

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

The pre-push hook checks only the newest commit of each pushed branch. A mistake in an older commit of the push does
not fail the hook when a newer commit fixes it. The pre-commit hook already ran the commit checks on each commit, so the
pre-push hook does not run them again. CI runs both. Checks that read the whole project, such as the type checker, can
report findings in files that you did not change.

When a hook cannot start gspot, the commit stops.
[Troubleshooting](/use/troubleshooting/#a-hook-cannot-find-npm-pnpm-yarn-bun-or-mise) shows how to fix it.

When the dependency files in your working tree differ from the checked commit, gspot prints this note:

```text
The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.
```

## Turn hooks on or off

To turn the hooks on, run:

```shell
gspot set hooks.enabled true
gspot install
```

To turn them off, run `gspot set hooks.enabled false`. gspot then deletes `.gspot/hooks` and unsets the Git setting
`core.hooksPath`.

## Existing hook managers

If Husky, Lefthook, pre-commit, `simple-git-hooks`, or a hooks folder of your own already runs your Git hooks, gspot
keeps those hooks and does not set `core.hooksPath`. A config file alone runs nothing, so Lefthook, pre-commit, and
`simple-git-hooks` count only when `.git/hooks` holds an executable hook, and a `.husky` folder counts only while
`core.hooksPath` points into it. Otherwise, `gspot install` turns the gspot hooks on.

`gspot install` prints what to add, and a hook without it runs no gspot checks. For a hook folder or `simple-git-hooks`,
add each line to the hook of the same name:

```shell
# pre-commit
.gspot/hooks/pre-commit "$@"
# pre-push
.gspot/hooks/pre-push "$@"
# commit-msg
.gspot/hooks/commit-msg "$@"
```

Lefthook passes no push input to a command without `use_stdin`, so add this to `lefthook.yml`:

```yaml
pre-commit:
  commands:
    gspot:
      run: .gspot/hooks/pre-commit
pre-push:
  commands:
    gspot:
      run: .gspot/hooks/pre-push {0}
      use_stdin: true
commit-msg:
  commands:
    gspot:
      run: .gspot/hooks/commit-msg {1}
```

pre-commit passes no push input to any hook, so the push checks run from `.git/hooks/pre-push`. Add this to the `repos`
of `.pre-commit-config.yaml`:

```yaml
- repo: local
  hooks:
    - id: gspot-pre-commit
      name: gspot pre-commit
      entry: .gspot/hooks/pre-commit
      language: system
      always_run: true
      pass_filenames: false
      stages: [pre-commit]
    - id: gspot-commit-msg
      name: gspot commit-msg
      entry: .gspot/hooks/commit-msg
      language: system
      always_run: true
      stages: [commit-msg]
```

Then run these commands. Each clone needs them, because `.git/hooks` is not tracked:

```shell
pre-commit install --hook-type pre-commit --hook-type commit-msg
printf '#!/bin/sh\n.gspot/hooks/pre-push "$@"\n' > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Test a hook

To run the checks of the pre-commit and commit-msg hooks without committing:

```shell
gspot check --staged --stage commit
gspot check --hook commit-msg -- .git/COMMIT_EDITMSG
```

The pre-push hook needs the remote arguments and the list of pushed commits that Git passes to it, so test it with a
real `git push`. After a failed push, the `rerun:` line of the report is `gspot check --only <check> --base <hash>`.
`<hash>` is the commit that the remote had, and the command checks the files that changed after it. To compare with a
branch without pushing:

```shell
gspot check --base origin/main
```

## Large files

When a tracked file has the Git attribute `filter=lfs`, gspot writes the `pre-push`, `post-checkout`, `post-commit`,
and `post-merge` hooks that Git Large File Storage (LFS) needs. A `filter=lfs` pattern that matches no tracked file does
not add these hooks. The `pre-push` hook runs the gspot checks before `git lfs pre-push`, so a push that the checks stop
uploads no LFS file. If `git-lfs` is not on `PATH`, the hook exits with code 2 before any check runs, and asks you to
install it. These hooks replace the default hooks that `git lfs install` writes, so LFS needs no other hook manager.

## When a hook fails

Fix each finding, then commit or push again. If a finding does not apply to your code, add an ignore with a reason, as
[Ignore findings](/use/ignore/) describes. The ignore then stops that finding on every run.
