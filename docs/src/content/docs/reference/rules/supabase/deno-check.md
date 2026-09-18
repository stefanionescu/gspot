---
title: "supabase/deno-check"
description: "Type checks the entry file of every edge function with deno check."
---

Type checks the entry file of every edge function with deno check.

## Why

The project compiler does not resolve the import map of a function, so only Deno sees its types.

## What to do

Fix the first error Deno prints; later ones are often the same mistake.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: push
- Tool: deno
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/deno-check --paths <glob> --reason "<why>"`.
