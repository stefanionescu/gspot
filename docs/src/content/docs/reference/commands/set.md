---
title: "gspot set"
description: "Write one setting; the key is the dotted path gspot doctor --settings prints"
---

Write one setting; the key is the dotted path gspot doctor --settings prints.

```text
gspot set [options] <key> [value...]
```

## Arguments

| Argument | Meaning  |
| -------- | -------- |
| `key`    | required |
| `value`  | optional |

## Options

| Flag              | Meaning                                             |
| ----------------- | --------------------------------------------------- |
| `--reason <text>` | Why; required when the change loosens a rule        |
| `--scope <path>`  | Write into a scope table instead of the root        |
| `--replace`       | For a list: replace the whole list                  |
| `--remove`        | For a list: remove the named items                  |
| `--default`       | Delete the key so the shipped default applies again |
| `--dry-run`       | Print what would be written and write nothing       |
