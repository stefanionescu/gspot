# `python`

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

|                      |                                                                              |
| -------------------- | ---------------------------------------------------------------------------- |
| Detect               | `.py` in the tree; `pyproject.toml`; `requirements*.txt`; a `python` shebang |
| Claims               | `.py`, `.pyi`, `pyproject.toml`, extensionless files with a `python` shebang |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling             |

## Tools

ruff, basedpyright, import-linter, pydoclint, deptry, vulture, validate-pyproject,
pyproject-fmt, uv. Installed through mise `pipx:` or a `gspot` dependency group in
`pyproject.toml`. bandit, pip-audit and interrogate are not used: Ruff `S`, osv-scanner and Ruff
`D1` do their jobs.

## Generated configuration

| Target                            | Stub                                                                      | Holds                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/ruff.toml`                | `[tool.ruff] extend` in `pyproject.toml`                                  | the selected families including `S` and `ANN401`, `PLR2004`, `PLR1702`, `PLR0917`, `FAST`; the ignores; the limits (`C901` at `cyclomatic_complexity`, `PLR0915` at `statements`, `PLR1702` at `nested_blocks`); format options from `[format]` |
| `.gspot/basedpyrightconfig.json`  | `pyrightconfig.json`                                                      | `typeCheckingMode: all`, `reportPrivateUsage`, `extraPaths`, includes from claims                                                                                                                                                               |
| `[tool.importlinter]`             | written into `pyproject.toml` through a TOML edit that preserves comments | root packages and contracts from `[architecture.contracts]`                                                                                                                                                                                     |
| `[tool.deptry]`, `[tool.vulture]` | same                                                                      | the reference options                                                                                                                                                                                                                           |

## Checks

| Id                                                                                                                                                             | Stage  | Command                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python/ruff`                                                                                                                                                  | commit | `ruff check --config .gspot/ruff.toml {files}`; fix order codemod                                                                                                                  |
| `python/ruff-format`                                                                                                                                           | commit | `ruff format --check`; fix order format                                                                                                                                            |
| `python/basedpyright`                                                                                                                                          | commit | `basedpyright --baselinefile .gspot/baselines/basedpyright.<scope>.json --outputjson`, run in the scope, which holds the `pyrightconfig.json` stub                                 |
| `python/import-linter`                                                                                                                                         | commit | `lint-imports`                                                                                                                                                                     |
| `python/pydoclint`                                                                                                                                             | commit | `pydoclint --allow-init-docstring true {files}` until Ruff `DOC` leaves preview                                                                                                    |
| `python/deptry`                                                                                                                                                | push   | `deptry <source roots>`                                                                                                                                                            |
| `python/vulture`                                                                                                                                               | push   | `vulture <roots> --min-confidence 80`                                                                                                                                              |
| `python/pyproject`                                                                                                                                             | commit | `validate-pyproject pyproject.toml`; `pyproject-fmt --check`                                                                                                                       |
| `python/file-length`, `python/function-length`                                                                                                                 | commit | code lines against `limits.file_lines` and `limits.function_lines`                                                                                                                 |
| `python/trivial-function`                                                                                                                                      | commit | single-use with at most two statements or ten nodes: inline it; exemptions by decorator, protocol, dataclass hook, dunder, visitor, main guard, and path-scoped names with reasons |
| `python/call-through`                                                                                                                                          | commit | direct forwarding at any use count                                                                                                                                                 |
| `python/private-prefix`                                                                                                                                        | commit | `_` for every top-level name `__all__` does not list; no `_` name in `__all__`; `_` for methods called from no other module                                                        |
| `python/private-before-public`                                                                                                                                 | commit | `_` names above public names; `__all__` last                                                                                                                                       |
| `python/exports-at-bottom`, `python/no-singletons`, `python/no-lazy-exports`, `python/package-exports`, `python/import-cycles`, `python/placeholder-docstring` | commit | engine, on the embedded Python grammar (D-98); `import-layout` is Ruff `E402` and `PLC0415`, and `import-boundary` is `python/import-linter`                                       |
| `integrity/typecheck-membership`, `dependency-ownership`, `lockfile-fresh` (`uv lock --check`)                                                                 | commit | engine                                                                                                                                                                             |
| `dependencies/osv` over `uv.lock`                                                                                                                              | push   | through dependencies                                                                                                                                                               |

basedpyright takes the folder of its configuration as the project root, and it baselines no file
outside that root. The generated configuration sits under `.gspot/`, so the scope holds a stub,
`pyrightconfig.json`, with one key: `extends`. It is generated and read-only, unlike the
`tsconfig.json` stub, because a repository has nothing of its own to keep in it. Takeover replaces
an old `pyrightconfig.json` and carries its `exclude` paths into `tools.basedpyright.exclude`, without
dot folders and the folders the preset leaves out by itself. `--writebaseline` rewrites its whole
file, so each scope keeps its own: `basedpyright.root.json`, `basedpyright.<scope>.json`.

## Settings

| Setting                                                                                                                       | Direction  | Default                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.ruff.select`, `tools.ruff.options` (per-rule options; a rule turned off is a `gspot ignore python/ruff --rule <code>`) | per-rule   | the ledger set                                                                                                                                                                                                                                                                    |
| per-file rule exemptions                                                                                                      | loosening  | none; written as `[[ignore]]` entries with `rule` and `paths`, rendered into `per-file-ignores`                                                                                                                                                                                   |
| `tools.basedpyright.exclude` (carries a reason)                                                                               | loosening  | none. A repository that must type-check some files under another dependency set excludes them here and adds a `[[check]]` (`command = ["uv", "run", "--extra", "trt", "basedpyright", "-p", "typecheck/trt.json"]`, `platform = "linux"`); gspot has no slot for that, on purpose |
| deptry rules turned off                                                                                                       | loosening  | none; `gspot ignore python/deptry --rule DEP002 --reason`                                                                                                                                                                                                                         |
| `tools.vulture.ignore_names`                                                                                                  | loosening  | none                                                                                                                                                                                                                                                                              |
| `architecture.contracts`                                                                                                      | tightening | none                                                                                                                                                                                                                                                                              |
| `architecture.package_roots`                                                                                                  | neutral    | detected from `pyproject.toml`                                                                                                                                                                                                                                                    |
| `architecture.roles.env`                                                                                                      | neutral    | the module that reads `os.environ`; detected as the one that reads it most at init                                                                                                                                                                                                |
| `structure.python.trivial_allowed` (path, names, reason)                                                                      | loosening  | none                                                                                                                                                                                                                                                                              |
| `structure.python.max_package_exports`                                                                                        | ceiling    | 20                                                                                                                                                                                                                                                                                |

## Rule files

`language/PYTHON.md`, `language/python/TYPING.md`, `language/python/DESIGN.md`, `language/python/FLOW.md`,
`language/python/PACKAGING.md`, `language/naming/PYTHON.md`.

## Not covered here

Notebook linting. Ruff runs over `.ipynb` when the repository has them, through a `[tools.ruff]`
slot; no other check reads notebooks.
