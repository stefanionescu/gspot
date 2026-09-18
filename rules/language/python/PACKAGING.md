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
  dependency pinned. `enforced-by: integrity/dependency-ownership`
- For pip-based deployment installs, use hash-checking mode with
  `--require-hashes`. `enforced-by: integrity/dependency-ownership`
- Use `sha256` hashes for package artifacts. `enforced-by: integrity/dependency-ownership`
- Hashes must cover every requirement and every transitive dependency in the
  requirements file. `enforced-by: integrity/dependency-ownership`
- Requirements used with `--require-hashes` must be pinned with `==`, a direct
  URL, or a filesystem path. `enforced-by: integrity/dependency-ownership`
- Use multiple hashes for a package when deployments may install different
  wheels for different supported platforms. `enforced-by: integrity/dependency-ownership`
- Disallow source distributions for deployment installs with
  `--only-binary :all:` when all required packages publish compatible wheels. `enforced-by: integrity/dependency-ownership`
- If a package must be installed from source, treat that as a deliberate
  supply chain exception. Keep the build environment explicit and reviewed. `unenforced`
- Do not rely on hashes embedded in package-index download URLs as the integrity
  control for deployment installs. The hash must be local to the requirements or
  lock material used by the install. `enforced-by: integrity/dependency-ownership`
- Do not use `--extra-index-url` for private packages in deployment installs.
  Prefer a single controlled `--index-url`, or `--no-index` with reviewed
  `--find-links` wheel artifacts. `enforced-by: integrity/dependency-ownership`
- Use `--no-deps` only when the requirements file already contains the complete
  resolved dependency tree. `enforced-by: integrity/dependency-ownership`
- Install the local project through pip, not direct setuptools commands. `unenforced`
- When project dependencies are already installed from a pinned and hashed
  requirements file, install the local project with `python -m pip install --no-deps .` or the editable equivalent for development workflows. `enforced-by: integrity/dependency-ownership`
- Do not call `python setup.py install`, `python setup.py develop`, or
  `easy_install`. `enforced-by: integrity/dependency-ownership`
- Do not weaken install security in a deploy script just to make an install pass.
  Fix the requirements or document the supply chain exception. `enforced-by: integrity/dependency-ownership`
- Do not add or regenerate dependency locks, hashes, or requirements files unless
  the requested task includes dependency maintenance. `enforced-by: integrity/dependency-ownership`

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

- Keep packages shallow and purposeful. `unenforced`
- Flatten packages that contain only `__init__.py` and one other module. `unenforced`
- Do not create single-file packages. `unenforced`
- Do not create import cycles. `unenforced`
- Do not create lazy module export hooks such as module-level `__getattr__`, `__dir__`, or
  `__getattribute__`. `enforced-by: structure/import-boundary`
- Do not use dynamic imports for lazy loading. `enforced-by: structure/import-layout`
- Do not use package `__init__.py` files to hide expensive imports. `unenforced`
- Keep `__init__.py` files small and import-stable. `enforced-by: structure/import-boundary`
- Barrel `__init__.py` files may contain imports and `__all__`. `enforced-by: structure/private-prefix`
- Respect the import-linter contracts the project configures. `unenforced`
- Keep lower-level packages independent of higher-level workflow packages. `unenforced`

## Source layout and import path

Rules:

- Keep importable repository code under `src/`. `unenforced`
- Do not create top-level import packages beside repository configuration files. `unenforced`
- Treat the repository root as project configuration and tooling space, not as the import package
  root. `unenforced`
- Run Python entrypoints through the configured environment, editable install, project scripts,
  or `python -m` with the intended import path. `enforced-by: integrity/dependency-ownership`
- Do not mutate `sys.path` in package code to make imports work. `enforced-by: integrity/dependency-ownership`
- Do not rely on the current working directory being first on Python's import path. `unenforced`
- Do not make root-level modules importable only in development. Code that works only because
  the process starts from the repository root is not packaged correctly. `unenforced`
- Keep helper scripts that are not meant to be imported outside the package import path. `unenforced`

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
