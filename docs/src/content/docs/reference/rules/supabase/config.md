---
title: "supabase/config"
description: "Checks that the project file parses, and that every function it configures has a folder with an index file."
---

Checks that the project file parses, and that every function it configures has a folder with an index file.

## Why

The CLI reads this file at every deploy, and a function it configures with no code fails there.

## What to do

Correct the file at the place the message names, or remove the table of a function the repository does not hold.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/config --paths <glob> --reason "<why>"`.
