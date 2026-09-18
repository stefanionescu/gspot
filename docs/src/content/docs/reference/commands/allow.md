---
title: "gspot allow"
description: "Add to an allow list: typos, typos-exclude, licenses, naming, naming-external, gitleaks, or osv"
---

Add to an allow list: typos, typos-exclude, licenses, naming, naming-external, gitleaks, or osv.

```text
gspot allow [options] <list> <value...>
```

## Arguments

| Argument | Meaning  |
| -------- | -------- |
| `list`   | required |
| `value`  | required |

## Options

| Flag               | Meaning                                       |
| ------------------ | --------------------------------------------- |
| `--reason <text>`  | Why; required for every list but typos words  |
| `--license <spdx>` | For licenses: the license the package reports |
| `--remove`         | Delete the matching entry instead             |
| `--dry-run`        | Print what would be written and write nothing |
