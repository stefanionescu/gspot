---
title: Python
description: Lint, format, type-check, and test Python projects.
---

The `python` configuration runs Ruff for lint and format, basedpyright, import-linter, pydoclint, and deptry, plus
built-in checks. The [Python configuration](/reference/configurations/python/) lists every check.

## Before you start

Install gspot with mise, as the [Quickstart](/start/quickstart/) shows for a repository without `package.json`. Use uv
for your project, and run `uv sync` before you run the checks: basedpyright and pytest read the `.venv` of the
project.

## Docstring style

pydoclint takes its docstring style from the first source that sets one:

1. A `[tool.pydoclint]` style in `pyproject.toml`.
2. The pydocstyle convention in the Ruff options of the project.
3. `tools.ruff.docstring_convention`, when it equals `google` or `numpy`.
4. Google or NumPy sections that gspot finds in your docstrings.

Otherwise, pydoclint uses its default.

See [Tests and coverage](/checks/testing/#python-with-pytest) for pytest.
