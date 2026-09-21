---
title: Add your own check
description: Run a repository command with explicit inputs, stage, and output.
---

Start with a repository command that exits 0 on success and nonzero on failure. For a project
using Bun, this complete policy runs `scripts/check-project.ts` during the commit stage:

```toml
version = 1
presets = []

[[check]]
name = "project/contract"
command = ["bun", "scripts/check-project.ts", "{files}"]
paths = ["src/**"]
stage = "commit"
summary = "Checks the project contract."
help = "Correct the project diagnostic, then run this check again."

[check.output]
format = "lines"
```

Create the named script before running the check. The command is an argument array, not a shell
expression. `{files}` expands the selected paths as arguments. Do not add shell quoting inside
an argument to compensate for spaces in filenames.

```bash
gspot apply
gspot check --only project/contract
```

A failing command remains a failed check. The output adapter determines how diagnostics become
findings. Use the [configuration reference](/reference/configuration/#check) for other output
formats. For JSON, map the tool fields under `[check.output.fields]` and identify nested arrays
with `items` or `children` as needed.

## Declare cache inputs

Add `inputs` only when file globs can describe everything the command reads. Include configuration,
lockfiles, scripts, and ignored inputs where applicable. Changed bytes or matching paths invalidate
the result. Leave `inputs` absent for a command whose result depends on uncaptured external state.

## Add a correction command

Set `fix_command` to an argument array and `fix_order` to `codemod`, `imports`, `manifest`, or
`format`. `gspot check --fix` runs correction commands in that order, then checks again.
Corrections change the working tree, not the staging area. Review partial changes if a correction
fails; do not treat a later clean check as proof that every correction succeeded.
