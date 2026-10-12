---
title: "Quickstart: Python"
description: Set up a Python project and fix a source finding.
---

Read [Install](/guides/install/) first.

Replace `<version>` with the version you install, such as `0.1.0`.

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

Pin gspot in the repository:

```shell
mise use node@24 'npm:@gspothq/cli@<version>'
git add mise.toml
git commit -m "build: Add gspot"
mise exec -- gspot init --yes --configurations python
```

`init` writes the files and installs nothing. Install the tools and check the setup:

```shell
mise exec -- gspot install
mise exec -- gspot check
```

Resolve findings in the initial project before committing. Apply the available formatting fixes and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

To scan dependency licenses, list allowed licenses first. See [Dependency licenses](/guides/dependency-licenses/).

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

Stage the file and run `git commit`. The pre-commit hook refuses the commit and prints the same finding.

## Fix the source

Restore the valid source from the setup commit:

```shell title="Restore the Python example"
git restore --source=HEAD --staged --worktree -- src/orders_python/__init__.py
mise exec -- gspot check --only python/ruff
```

The same check now reports no syntax finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings before committing.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
