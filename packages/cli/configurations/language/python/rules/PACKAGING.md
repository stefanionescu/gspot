# Python Packaging

Read this rule when you change Python dependencies, lockfiles, or package layout.

## Lockfiles

Update lockfiles only when the task includes dependency maintenance.

## Imports

- Keep imports inside the `[[import_rule]]` records of `gspot.toml`; `structure/import-rules` checks them.

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
