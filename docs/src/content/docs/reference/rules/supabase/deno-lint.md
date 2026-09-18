---
title: "supabase/deno-lint"
description: "Runs deno lint over every edge function, with the function's own deno.json."
---

Runs deno lint over every edge function, with the function's own deno.json.

## Why

Edge functions run under Deno, and its linter knows the runtime the Node rules do not.

## What to do

Change the code the way the rule says; deno lint --rules explains each one.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: commit
- Tool: deno
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/deno-lint --paths <glob> --reason "<why>"`.
