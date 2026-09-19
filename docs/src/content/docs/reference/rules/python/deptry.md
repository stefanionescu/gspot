---
title: "python/deptry"
description: "Compares the imports of the project with the dependencies it declares: missing, unused, and transitive ones."
---

Compares the imports of the project with the dependencies it declares: missing, unused, and transitive ones.

## Why

An import that works through somebody else's dependency breaks the day they drop it.

## What to do

Declare the dependency, or remove the one nothing imports. Turn one rule off with gspot ignore python/deptry --rule <code> --reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: push
- Tool: deptry

Turn it off for a path with a reason: `gspot ignore python/deptry --paths <glob> --reason "<why>"`.
