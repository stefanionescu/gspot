---
title: "Quickstart: Python"
description: Initialize a Python project and correct a source finding.
---

Read [Requirements](/guides/requirements/) and [Install](/guides/install/) first.

Replace `<version>` with the exact version from the [npm package page](https://www.npmjs.com/package/@gspothq/cli).

## Create the project

```shell
mkdir orders-python && cd orders-python
git init
uv init --lib
uv sync
git add -A
git commit -m "feat: Create the project"
```

## Set up gspot

From a clean working tree, initialize and choose mise as the runner:

```shell
mise exec npm:@gspothq/cli@<version> -- gspot init --configurations python
```

Read the plan and accept it. Initialization prepares lockfiles and installs applicable tools. Trust the generated mise file, then prepare and diagnose the setup:

```shell
mise trust .mise/conf.d/gspot-tools.toml
mise install
mise exec -- gspot install
mise exec -- gspot doctor
mise exec -- gspot check
```

Resolve findings in the initial project before committing. Apply the available formatting fixes and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

`pyproject.toml` selects the general `licenses` configuration automatically. Choose your [dependency license policy](/guides/dependency-licenses/) explicitly. The `licenses/allowed` check makes no license comparison until you set an allowed license or exception.

```shell
git add -A
git commit -m "chore: Set up gspot"
```

## See a finding

Temporarily replace a source file with this invalid Python source:

```text title="src/orders_python/__init__.py"
def total(items):
    return sum(items
```

Run the source check:

```shell
mise exec -- gspot check --only python/ruff
```

The check exits nonzero and reports:

```text
src/orders_python/__init__.py:3:1  invalid-syntax  unexpected EOF while parsing
```

Stage the invalid file and attempt a commit to see the pre-commit hook reject it. The report names the file and explains the correction.

## Correct the source

Restore the valid source from the setup commit:

```shell title="Restore the Python example"
git restore --source=HEAD --staged --worktree -- src/orders_python/__init__.py
mise exec -- gspot check --only python/ruff
```

The same check now reports no syntax finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings before committing.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
