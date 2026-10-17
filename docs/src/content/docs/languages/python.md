---
title: Python
description: Set up Python checks with uv, Ruff, pyright, and pytest.
---

Set up gspot with the [Quickstart](/start/quickstart/). In a Python repository, use uv for your project dependencies and mise to install gspot.

To create a Python library, run `uv init --lib` in the repository root. Then install its dependencies:

```shell
uv sync
mise exec -- gspot install
mise exec -- gspot check --only python/ruff python/basedpyright
```

pydoclint takes its docstring style from the first source that sets one:

1. A `[tool.pydoclint]` style in `pyproject.toml`.
2. The pydocstyle convention in the Ruff options of the project.
3. `tools.ruff.docstring_convention`, when it equals `google` or `numpy`.
4. Google or NumPy sections that gspot finds in your docstrings.

Otherwise, pydoclint uses its default.

See [Tests and coverage](/checks/testing/#python) for pytest.

## Ruff

`python/ruff` checks Python source and reports each lint rule by its Ruff code. Run `gspot check --fix` for the
available fixes, then read the findings that remain. The Ruff lint rules for pytest cover the files that
`test_files` selects.
