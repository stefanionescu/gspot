---
title: Python
description: Set up Python checks with uv, Ruff, pyright, and pytest.
---

Set up gspot with the [Quickstart](/start/quickstart/). In a Python repository, use uv for your project dependencies and mise to install gspot.

To create a Python library, run `uv init --lib` in the repository root. Then install its dependencies:

```shell
uv sync
mise exec -- gspot install
mise exec -- gspot check --only python/ruff python/pyright
```

An explicit `[tool.pydoclint]` style in `pyproject.toml` wins. Otherwise, pydoclint follows the project Ruff pydocstyle convention, then `tools.ruff.docstring_convention` when it equals `google` or `numpy`. Without a declared style, gspot detects sections that use Google or NumPy conventions in source docstrings. Other conventions do not select a pydoclint style. If neither a declaration nor the source selects a style, pydoclint uses its default.

See [Tests and coverage](/checks/testing/#python) for pytest.

## Ruff

`python/ruff` checks Python source and reports each lint rule by its Ruff code. Run `gspot check --fix` to apply
available fixes, then read the findings that remain. Ruff rules for pytest apply to test files selected by
`test_files`.
