# `pytest`

Kind: tool. Requires: python.

## Detects and claims

|        |                                                                |
| ------ | -------------------------------------------------------------- |
| Detect | `pytest` in dependencies or dependency groups; `[tool.pytest]` |
| Claims | `tests/**/*.py`, `test_*.py`, `*_test.py`, `conftest.py`       |

## Tools

pytest, pytest-cov.

## Generated configuration

`.gspot/ruff.toml` keeps the `PT` family on and adds test-file overrides: `S101` (assert) off in
gspot writes nothing into `pyproject.toml`. The coverage check passes its options by flag (D-117).
with `testpaths` from claims and `addopts = "-q --strict-markers --strict-config"`.

## Checks

| Id                           | Stage  | Command                                                                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `python/ruff`                | commit | with `PT001` to `PT027` on                                                                      |
| `pytest/coverage`            | push   | `pytest --cov --cov-fail-under=<threshold>`                                                     |
| `structure/trivial-function` | commit | setup decorators retain their required external names                                           |
| `naming/identifiers`         | commit | `test_` is a structural prefix for test functions; test-data directories need descriptive names |

## Settings

`tools.pytest.coverage` (default 80), `tools.pytest.testpaths`.

## Rule files

`general/code/TESTING.md`; the Tests section of `language/PYTHON.md`.
