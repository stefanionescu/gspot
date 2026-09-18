---
title: "gspot check"
description: "Run the checks and print findings; one check when its id is given"
---

Run the checks and print findings; one check when its id is given.

```text
gspot check [options] [check-id]
```

## Arguments

| Argument   | Meaning  |
| ---------- | -------- |
| `check-id` | optional |

## Options

| Flag                    | Meaning                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `--staged`              | The commit stage over staged files, as the pre-commit hook runs it |
| `--since <ref>`         | Commit and push stages over files changed since a git ref          |
| `--fix`                 | Run every fixer in order, then the checks again                    |
| `--dry-run`             | With --fix, print the diff of every fix and write nothing          |
| `--stage <stage>`       | One stage                                                          |
| `--scope <path>`        | One scope only                                                     |
| `--skip <check-id>`     | Skip one check this run; repeat for more                           |
| `--message-file <path>` | The commit message file, for the message stage                     |
| `--no-cache`            | Run every check even when its inputs are unchanged                 |
