---
title: "Quickstart: Python"
description: Set up a Python project and fix a source finding.
---

Read [Install](/guides/install/) first.

Replace `<version>` with the version you install, such as `0.1.2`.

## Create the project

```shell
mkdir orders-python && cd orders-python
git init
uv init --lib
uv sync
```

## Install gspot

Pin gspot in the repository:

```shell
mise use node@24 --tool-option allow_low_downloads=true 'npm:@gspothq/cli@<version>'
```

## Set up the tools

```shell
mise exec -- gspot init --yes --configurations python
```

`init` writes the files and installs nothing. Install the tools:

```shell
mise exec -- gspot install
```

## Check the project

Run checks when you want to inspect the project:

```shell
mise exec -- gspot check
```

Apply the available formatting fixes and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

To scan dependency licenses, list allowed licenses first. See [Dependency licenses](/guides/dependency-licenses/).

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

## Try the hook

Before fixing the source, you can stage the invalid file and try to commit it:

```shell
git add src/orders_python/__init__.py
git commit -m "feat: Add calculation"
```

The pre-commit hook refuses the commit and prints the same finding. After you fix the source, stage the valid file before you try the commit again.

## Fix the source

Close the missing parenthesis:

```python title="src/orders_python/__init__.py"
def total(items):
    return sum(items)
```

```shell
mise exec -- gspot check --only python/ruff
```

The same check now reports no syntax finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
