---
title: "nextjs/typecheck"
description: "Has Next.js write its types, then type-checks the app with the strict compiler options."
---

Has Next.js write its types, then type-checks the app with the strict compiler options.

## Why

A fresh clone holds no next-env.d.ts and no route types, so a plain tsc run fails on imports the framework resolves.

## What to do

Read the first error tsc prints and fix that file; later errors are often the same mistake.

## Where it runs

- Preset: [the nextjs preset](/reference/presets/nextjs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore nextjs/typecheck --paths <glob> --reason "<why>"`.
