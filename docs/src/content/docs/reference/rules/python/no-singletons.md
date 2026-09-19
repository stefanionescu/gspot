---
title: "python/no-singletons"
description: "Finds objects built at import time and kept in a module variable."
---

Finds objects built at import time and kept in a module variable.

## Why

Every importer shares the one instance, and no test gets a fresh one.

## What to do

Build the object where the program starts, and pass it in. Allow a name under structure.python.singletons_allowed with a reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/no-singletons --paths <glob> --reason "<why>"`.
