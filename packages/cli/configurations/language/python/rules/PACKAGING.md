# Python Packaging

Read this rule when you change Python dependencies, lockfiles, or package layout.

## Package installation security

Install from the uv lockfile:

```bash
uv sync --frozen
```

Update lockfiles only
when the task includes dependency maintenance.

## Import correctness

- Respect the import-linter contracts the project declares.
- Run each entrypoint through the configured environment, the installed package, or `python -m`.
- Make packaged imports work outside the repository root. Do not depend on an accidental
  current-folder import path.

## Packages and architecture

<!-- level: all -->

- Keep packages shallow and purposeful.
- Flatten packages that contain only `__init__.py` and one other module.
- Do not use package `__init__.py` files to hide expensive imports.
- Keep `__init__.py` files small and import-stable.
- Barrel `__init__.py` files may contain imports and `__all__`.
- Keep lower-level packages independent of higher-level workflows.

## Source layout

<!-- level: all -->

Keep the layout the project has. A new package puts its code under `src/`:

```text
pyproject.toml
src/
  order_service/
    __init__.py
    orders.py
    accounts.py
```

Keep unimported helper scripts outside the package import path.
