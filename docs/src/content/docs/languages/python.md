---
title: Python
description: Set up Python checks with uv, Ruff, pyright, and pytest.
---

Set up gspot with the [Quickstart](/start/quickstart/). In a Python repository, use uv for your project dependencies and mise to install gspot.

pydoclint takes its docstring style from the first source that sets one:

1. A `[tool.pydoclint]` style in `pyproject.toml`.
2. The pydocstyle convention in the Ruff options of the project.
3. `tools.ruff.docstring_convention`, when it equals `google` or `numpy`.
4. Google or NumPy sections that gspot finds in your docstrings.

Otherwise, pydoclint uses its default.

See [Tests and coverage](/checks/testing/#python-with-pytest) for pytest.
