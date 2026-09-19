---
title: "integrity/dependency-ownership"
description: "Checks that pyproject.toml owns every dependency: no hand-kept requirements file, and no pip install outside the allowed paths."
---

Checks that pyproject.toml owns every dependency: no hand-kept requirements file, and no pip install outside the allowed paths.

## Why

Two owners of the dependency list drift apart, and the image installs what the lockfile never saw.

## What to do

Export the requirements file from the lockfile and declare it generated, and replace pip install with the locked install. Allow a path under tools.dependencies.pip_install_allowed with a reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/dependency-ownership --paths <glob> --reason "<why>"`.
