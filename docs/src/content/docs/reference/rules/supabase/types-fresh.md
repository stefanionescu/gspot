---
title: "supabase/types-fresh"
description: "Compares tools.supabase.types_file with the types the CLI writes from the local database."
---

Compares tools.supabase.types_file with the types the CLI writes from the local database.

## Why

Stale types let code compile against a column the database dropped.

## What to do

Run supabase gen types typescript --local and write the output to the file.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: push
- Tool: supabase
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/types-fresh --paths <glob> --reason "<why>"`.
