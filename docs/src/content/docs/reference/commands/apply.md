---
title: "gspot apply"
description: "Re-render every generated file from gspot.toml; idempotent"
---

Re-render every generated file from gspot.toml; idempotent.

```text
gspot apply [options]
```

## Options

| Flag                  | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `--check`             | Render in memory and fail with a diff when a generated file differs     |
| `--lower-baselines`   | Lower every baseline to the last run's counts; never raise one          |
| `--project-templates` | Copy the project templates that match into the project rule layer, once |
