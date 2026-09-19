---
title: "integrity/dependency-alignment"
description: "Checks that packages that ship together sit on one version: the framework with its lint package, and react with react-dom."
---

Checks that packages that ship together sit on one version: the framework with its lint package, and react with react-dom.

## Why

A lint package a version behind flags what the framework allows and allows what it removed.

## What to do

Move both packages to the same version.

## Where it runs

- Preset: [the nextjs preset](/reference/presets/nextjs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/dependency-alignment --paths <glob> --reason "<why>"`.
