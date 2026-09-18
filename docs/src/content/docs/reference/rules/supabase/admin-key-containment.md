---
title: "supabase/admin-key-containment"
description: "Checks that the service role key is named only under tools.supabase.admin_key_paths."
---

Checks that the service role key is named only under tools.supabase.admin_key_paths.

## Why

The service role key bypasses row level security, so one client bundle that holds it gives every user the whole database.

## What to do

Move the code to a server path, or add the path to tools.supabase.admin_key_paths when it never reaches a client.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/admin-key-containment --paths <glob> --reason "<why>"`.
