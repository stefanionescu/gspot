---
title: "supabase/storage-policies"
description: "Checks that every storage bucket in the project file has a policy on storage.objects that names it."
---

Checks that every storage bucket in the project file has a policy on storage.objects that names it.

## Why

A bucket with no policy is closed to everyone or, when it is public, open to everyone, and neither is a decision anybody wrote down.

## What to do

Add a policy on storage.objects for the bucket in a migration.

## Where it runs

- Preset: [the supabase preset](/reference/presets/supabase/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore supabase/storage-policies --paths <glob> --reason "<why>"`.
