---
title: "security/codeql"
description: "Builds a CodeQL database for every language in tools.codeql.languages and runs the security suite over it."
---

Builds a CodeQL database for every language in tools.codeql.languages and runs the security suite over it.

## Why

Data-flow analysis follows a value from a request to a query across files, which a pattern rule cannot.

## What to do

Change the code the result names. Record a false positive under tools.codeql.false_positives with its rule, its paths, and a reason.

## Where it runs

- Preset: [the security preset](/reference/presets/security/)
- Stage: manual
- Tool: codeql
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore security/codeql --paths <glob> --reason "<why>"`.
