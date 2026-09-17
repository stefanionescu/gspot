# python

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

| | |
| --- | --- |
| Detect | `.py` in the tree; `pyproject.toml`; `requirements*.txt`; a `python` shebang |
| Claims | `.py`, `.pyi`, `pyproject.toml`, extensionless files with a `python` shebang |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling |

## Tools

ruff, basedpyright, import-linter, pydoclint, deptry, vulture, validate-pyproject,
pyproject-fmt, uv. Installed through mise `pipx:` or a `gspot` dependency group in
`pyproject.toml`. bandit, pip-audit and interrogate are not used: Ruff `S`, osv-scanner and Ruff
`D1` do their jobs.

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/ruff.toml` | `[tool.ruff] extend` in `pyproject.toml` | the selected families including `S` and `ANN401`, `PLR2004`, `PLR1702`, `PLR0917`, `FAST`; the ignores; the limits (`C901` at `cyclomatic_complexity`, `PLR0915` at `statements`, `PLR1702` at `nested_blocks`); format options from `[format]` |
| `.gspot/basedpyrightconfig.json` | `pyrightconfig.json` | `typeCheckingMode: all`, `reportPrivateUsage`, `extraPaths`, includes from claims; per-variant projects from `[tools.basedpyright.projects]` |
| `[tool.importlinter]` | written into `pyproject.toml` through a TOML edit that preserves comments | root packages and contracts from `[architecture.contracts]` |
| `[tool.deptry]`, `[tool.vulture]` | same | the reference options |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `python/ruff` | commit | `ruff check --config .gspot/ruff.toml {files}`; fix order codemod |
| `python/ruff-format` | commit | `ruff format --check`; fix order format |
| `python/basedpyright` | commit | `basedpyright -p <project>` per project |
| `python/import-linter` | commit | `lint-imports` |
| `python/pydoclint` | commit | `pydoclint --allow-init-docstring true {files}` until Ruff `DOC` leaves preview |
| `python/deptry` | push | `deptry <source roots>` |
| `python/vulture` | push | `vulture <roots> --min-confidence 80` |
| `python/pyproject` | commit | `validate-pyproject pyproject.toml`; `pyproject-fmt --check` |
| `structure/file-length`, `function-length` (code lines) | commit | engine |
| `structure/trivial-function` | commit | single-use with at most two statements or ten nodes: inline it; exemptions by decorator, protocol, dataclass hook, dunder, visitor, main guard, and path-scoped names with reasons |
| `structure/call-through` | commit | direct forwarding at any use count |
| `structure/private-prefix` | commit | `_` for every top-level name `__all__` does not list; no `_` name in `__all__`; `_` for methods called from no other module |
| `structure/private-before-public` | commit | `_` names above public names; `__all__` last |
| `structure/exports-at-bottom`, `no-singletons`, `no-lazy-exports`, `import-layout`, `import-boundary`, `import-cycles`, `package-exports`, `prefix-collisions`, `file-directory-collision`, `single-file-folder`, `placeholder-docstring`, `folder-names`, `env-access-owner` | commit | engine |
| `integrity/typecheck-membership`, `dependency-ownership`, `lockfile-fresh` (`uv lock --check`) | commit | engine |
| `dependencies/osv` over `uv.lock` | push | through dependencies |

## Settings

| Setting | Direction | Default |
| --- | --- | --- |
| `tools.ruff.select`, `tools.ruff.ignore` (ignore carries a reason) | per-rule | the ledger set |
| `tools.ruff.per_file_ignores` | loosening | none |
| `tools.basedpyright.projects` | neutral | one project over every claimed file |
| `tools.basedpyright.exclude` (carries a reason) | loosening | none |
| `tools.deptry.ignore` | loosening | none |
| `tools.vulture.ignore_names` | loosening | none |
| `architecture.contracts` | tightening | none |
| `architecture.package_roots` | neutral | detected from `pyproject.toml` |
| `architecture.roles.env` | neutral | the module that reads `os.environ`; detected as the one that reads it most at init |
| `structure.python.trivial_exemptions` (path, names, reason) | loosening | none |
| `structure.python.max_package_exports` | ceiling | 20 |

## Rule files

`language/PYTHON.md`, `language/python/TYPING.md`, `language/python/DESIGN.md`, `language/python/FLOW.md`,
`language/python/PACKAGING.md`, `language/naming/PYTHON.md`.

## Not covered here

Notebook linting. Ruff runs over `.ipynb` when the repository has them, through a `[tools.ruff]`
slot; no other check reads notebooks.
