---
title: "gspot check"
description: "Run checks over the selected files and folders and print findings"
---

Run checks over the selected files and folders and print findings.

```text
gspot check [options] [paths...]
```

## Arguments

| Argument | Meaning  |
| -------- | -------- |
| `paths`  | optional |

## Options

| Flag                 | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `--only <checks...>` | Run the named checks                                               |
| `--staged`           | The commit stage over staged files, as the pre-commit hook runs it |
| `--since <ref>`      | Commit and push stages over files changed since a git ref          |
| `--fix`              | Run every fixer in order, then the checks again                    |
| `--dry-run`          | With --fix, print the diff of every fix and write nothing          |
| `--stage <stage>`    | One stage                                                          |
| `--scope <path>`     | One scope only                                                     |
| `--skip <checks...>` | Skip the named checks for this run                                 |
| `--no-cache`         | Run every check even when its inputs are unchanged                 |
