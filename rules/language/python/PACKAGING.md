---
layer: language
preset: python
title: Python Packaging
---

# Python Packaging

Deployment installs, lock files, and hash checking.

## Package installation security

These rules apply to deployment scripts, release images, CI release installs,
production environment bootstraps, and any committed install command meant to
create a repeatable runtime environment.

Rules:

- Prefer a generated lock or requirements file with every direct and transitive
  dependency pinned.
- For pip-based deployment installs, use hash-checking mode with
  `--require-hashes`.
- Use `sha256` hashes for package artifacts.
- Hashes must cover every requirement and every transitive dependency in the
  requirements file.
- Requirements used with `--require-hashes` must be pinned with `==`, a direct
  URL, or a filesystem path.
- Use multiple hashes for a package when deployments may install different
  wheels for different supported platforms.
- Disallow source distributions for deployment installs with
  `--only-binary :all:` when all required packages publish compatible wheels.
- If a package must be installed from source, treat that as a deliberate
  supply chain exception. Keep the build environment explicit and reviewed.
- Do not rely on hashes embedded in package-index download URLs as the integrity
  control for deployment installs. The hash must be local to the requirements or
  lock material used by the install.
- Do not use `--extra-index-url` for private packages in deployment installs.
  Prefer a single controlled `--index-url`, or `--no-index` with reviewed
  `--find-links` wheel artifacts.
- Use `--no-deps` only when the requirements file already contains the complete
  resolved dependency tree.
- Install the local project through pip, not direct setuptools commands.
- When project dependencies are already installed from a pinned and hashed
  requirements file, install the local project with `python -m pip install --no-deps .` or the editable equivalent for development workflows.
- Do not call `python setup.py install`, `python setup.py develop`, or
  `easy_install`.
- Do not weaken install security in a deploy script just to make an install pass.
  Fix the requirements or document the supply chain exception.
- Do not add or regenerate dependency locks, hashes, or requirements files unless
  the requested task includes dependency maintenance.

Good deployment install:

```bash
python -m pip install \
  --require-hashes \
  --only-binary :all: \
  --no-deps \
  -r requirements.lock
```

Good local project install after dependency install:

```bash
python -m pip install --no-deps .
```

Good editable install for development:

```bash
python -m pip install --no-deps -e .
```

Good hashed requirement:

```text
example-package==1.2.3 \
  --hash=sha256:1111111111111111111111111111111111111111111111111111111111111111 \
  --hash=sha256:2222222222222222222222222222222222222222222222222222222222222222
```

## Packages and architecture

Rules:

- Keep packages shallow and purposeful.
- Flatten packages that contain only `__init__.py` and one other module.
- Do not create single-file packages.
- Do not create import cycles.
- Do not create lazy module export hooks such as module-level `__getattr__`, `__dir__`, or
  `__getattribute__`.
- Do not use dynamic imports for lazy loading.
- Do not use package `__init__.py` files to hide expensive imports.
- Keep `__init__.py` files small and import-stable.
- Barrel `__init__.py` files may contain imports and `__all__`.
- Respect the import-linter contracts the project configures.
- Keep lower-level packages independent of higher-level workflow packages.

## Source layout and import path

Rules:

- Keep importable repository code under `src/`.
- Do not create top-level import packages beside repository configuration files.
- Treat the repository root as project configuration and tooling space, not as the import package
  root.
- Run Python entrypoints through the configured environment, editable install, project scripts,
  or `python -m` with the intended import path.
- Do not mutate `sys.path` in package code to make imports work.
- Do not rely on the current working directory being first on Python's import path.
- Do not make root-level modules importable only in development. Code that works only because
  the process starts from the repository root is not packaged correctly.
- Keep helper scripts that are not meant to be imported outside the package import path.

Good layout:

```text
.
  pyproject.toml
  README.md
  src/
    config/
      __init__.py
      runtime/
        __init__.py
        engine.py
    runtime/
      __init__.py
      settings.py
```

Bad layout:

```text
.
  pyproject.toml
  config/
    __init__.py
  runtime/
    __init__.py
```

Bad single-file package:

```text
src/
  metrics/
    __init__.py
    accuracy.py
```

Use a module instead:

```text
src/
  metrics.py
```
