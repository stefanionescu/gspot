---
title: Python Packaging
---

# Python Packaging

Deployment installs, lockfiles, and hash checking.

## Package installation security

Install from the uv lockfile:

```bash
uv sync --frozen
```

At level `all`, use pip only in paths listed in `tools.pip.installs_allowed`. Update lockfiles only
when the task includes dependency maintenance.

## Import correctness

- Respect the import-linter contracts the project declares.
- Run entrypoints through the configured environment, installation, or module entrypoint.
- Ensure packaged imports work outside the repository root. Do not depend on an accidental
  current-directory import path.

## Packages and architecture

<!-- level: all -->

Rules:

- Keep packages shallow and purposeful.
- Flatten packages that contain only `__init__.py` and one other module.
- Do not create single-file packages.
- Do not use dynamic imports for lazy loading.
- Do not use package `__init__.py` files to hide expensive imports.
- Keep `__init__.py` files small and import-stable.
- Barrel `__init__.py` files may contain imports and `__all__`.
- Keep lower-level packages independent of higher-level workflow packages.

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

Keep helper scripts that are not meant to be imported outside the package import path.
