---
title: "xctest/reference-images"
description: "Checks that every folder of snapshot references sits beside a test file of the same name."
---

Checks that every folder of snapshot references sits beside a test file of the same name.

## Why

References of a deleted test stay in the repository, and every clone pays for them.

## What to do

Delete the references of the test that is gone, or rename the folder after the test file.

## Where it runs

- Preset: [the xctest preset](/reference/presets/xctest/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xctest/reference-images --paths <glob> --reason "<why>"`.
