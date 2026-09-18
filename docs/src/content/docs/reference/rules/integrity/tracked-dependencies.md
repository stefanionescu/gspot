---
title: "integrity/tracked-dependencies"
description: "Checks that git tracks no file inside a folder a package manager fills, such as node_modules."
---

Checks that git tracks no file inside a folder a package manager fills, such as node_modules.

## Why

An installed dependency in git is copied into every clone, goes stale the day it lands, and hides from every check because it looks vendored.

## What to do

Run git rm -r --cached <folder>, and write the folder name with no leading slash in .gitignore so it matches at every depth.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/tracked-dependencies --paths <glob> --reason "<why>"`.
