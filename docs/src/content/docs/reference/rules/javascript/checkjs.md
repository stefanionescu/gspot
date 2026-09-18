---
title: "javascript/checkjs"
description: "Type-checks plain JavaScript through its JSDoc comments."
---

Type-checks plain JavaScript through its JSDoc comments.

## Why

A JavaScript file with a wrong call crashes at run time; the checker sees it first when the types are written down.

## What to do

Add or fix the JSDoc type the checker names; gspot explain tsc/TS2345 links the error page.

## Where it runs

- Preset: [the javascript preset](/reference/presets/javascript/)
- Stage: commit
- Tool: tsc

Turn it off for a path with a reason: `gspot ignore javascript/checkjs --paths <glob> --reason "<why>"`.
