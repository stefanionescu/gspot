---
title: "gspot apply"
description: "Re-render every generated file from gspot.toml; idempotent"
---

Re-render every generated file from gspot.toml; idempotent.

```text
gspot apply [options]
```

## Options

| Flag                    | Meaning                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `--check`               | Render in memory and fail with a diff when a generated file differs           |
| `--lower-baselines`     | Lower every baseline to the last run's counts; never raise one                |
| `--baseline <check-id>` | Write the first baseline of one check; a baseline that exists is never raised |
