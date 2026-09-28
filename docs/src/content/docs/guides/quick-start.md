---
title: Quickstart
description: Check Python and Bash together, correct two defects, and rerun the same command.
---

Check a Python settings parser and a shell archive script in one repository. Ruff reports
executable input; ShellCheck reports a path that breaks when its filename contains spaces.

Complete [source installation](/guides/install/), including the `gspot` shell function.
Use Bash on macOS or Linux, Git, and network access for tool installation.

## Create the repository

In the same shell, create a disposable directory and provision the native tools:

```bash
example_root="$(mktemp -d)"
cd "$example_root"
git init -q
mise use uv@0.12.13 shellcheck@0.11.0 shfmt@3.12.0
eval "$(mise env --shell bash)"
mkdir src scripts
```

Save this complete policy as `gspot.toml`:

```toml
version = 1
configurations = ["python", "bash"]
level = "recommended"
```

Save this Python project metadata as `pyproject.toml`:

```toml
[project]
name = "settings-example"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []
```

Save the parser as `src/settings.py`:

```python
import json


def normalize_settings(source: str) -> str:
    return json.dumps(eval(source), sort_keys=True)
```

Save the script as `scripts/list-archive.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

archive=$1
tar -tf $archive
```

## Generate, install, and check

From the example directory, run:

```bash
gspot apply
gspot install
gspot check
```

Apply generates configuration and tool locks. Install prepares the locked tools. Check runs
them and exits `1` with these findings:

| File                          | Check             | Finding                                 |
| ----------------------------- | ----------------- | --------------------------------------- |
| `src/settings.py:5:23`        | `python/ruff`     | `S307`: input reaches `eval`.           |
| `scripts/list-archive.sh:5:9` | `bash/shellcheck` | `SC2086`: the archive path is unquoted. |

For the check's explanation and correction guidance, run:

```bash
gspot explain python/ruff
gspot explain shellcheck/SC2086
```

The report also names skipped checks. This example configures no Python import contract,
so `python/import-linter` is skipped.

## Correct both files

Replace `src/settings.py` with a parser for JSON values:

```python
import json


def normalize_settings(source: str) -> str:
    return json.dumps(json.loads(source), sort_keys=True)
```

Replace `scripts/list-archive.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

archive=$1
tar -tf "$archive"
```

Run `gspot check` again. With gspot 0.1.0 and the generated tool pins, the same repository
reports 22 checks passed, one check skipped, and no findings. The command exits `0`.
These corrections are manual; a formatter cannot choose the intended input format for you.

Reports are saved under `.gspot/reports/`. To inspect only the two affected checks later:

```bash
gspot check --only python/ruff bash/shellcheck
```

## Use it in your project

Follow [existing repositories](/guides/existing-repository/) to preview adoption without
losing existing settings. Add [Git hooks or CI](/guides/hooks-and-ci/) to run checks before
changes reach the default branch.

The disposable example is stored at `example_root`. Leave it before removing it when you
have finished inspecting the files and reports.
