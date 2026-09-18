---
title: "gspot uninstall"
description: "Remove what init wrote; keep gspot.toml and the project rule layer"
---

Remove what init wrote; keep gspot.toml and the project rule layer.

```text
gspot uninstall [options]
```

## Options

| Flag           | Meaning                           |
| -------------- | --------------------------------- |
| `--keep-hooks` | Leave core.hooksPath as it is     |
| `--yes`        | Skip the question                 |
| `--dry-run`    | Print the plan and remove nothing |
