---
title: "gspot ignore"
description: "Turn a check, or one rule in it, off for some paths or everywhere, with a reason"
---

Turn a check, or one rule in it, off for some paths or everywhere, with a reason.

```text
gspot ignore [options] <check-id>
```

## Arguments

| Argument   | Meaning  |
| ---------- | -------- |
| `check-id` | required |

## Options

| Flag                | Meaning                                                     |
| ------------------- | ----------------------------------------------------------- |
| `--paths <glob...>` | The paths the ignore applies to; none means the whole scope |
| `--rule <rule>`     | One rule inside the check                                   |
| `--reason <text>`   | Why; required, and printed on every run                     |
| `--remove`          | Delete the matching entry instead                           |
