# Python Configuration

An explicit `[tool.pydoclint]` style in `pyproject.toml` wins. Otherwise, pydoclint follows the project Ruff pydocstyle convention, then `tools.ruff.docstring_convention` when it equals `google` or `numpy`. Without a declared style, gspot detects sections that use Google or NumPy conventions in source docstrings. Other conventions do not select a pydoclint style. If neither a declaration nor the source selects a style, pydoclint uses its default.
