# pytest

Kind: tool. Requires: python.

## Detects and claims

| | |
| --- | --- |
| Detect | `pytest` in dependencies or dependency groups; `[tool.pytest]` |
| Claims | `tests/**/*.py`, `test_*.py`, `*_test.py`, `conftest.py` |

## Tools

pytest, pytest-cov.

## Generated configuration

`.gspot/ruff.toml` keeps the `PT` family on and adds test-file overrides: `S101` (assert) off in
tests, `ARG` off for fixtures, `PLR2004` off in tests. `[tool.pytest.ini_options]` is written
with `testpaths` from claims and `addopts = "-q --strict-markers --strict-config"`.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `python/ruff` | commit | with `PT001` to `PT027` on |
| `pytest/coverage` | push | `pytest --cov --cov-fail-under=<threshold>` |
| `structure/trivial-function` | commit | `pytest.fixture` is an exempt decorator |
| `naming/identifiers` | commit | `test_` is a structural prefix for test functions; `fixtures` stays banned as a directory name |

## Settings

`tools.pytest.coverage` (default 80), `tools.pytest.testpaths`.

## Rule files

`general/code/TESTING.md`; the Tests section of `language/PYTHON.md`.
