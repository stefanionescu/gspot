---
title: "Supabase"
description: "A Supabase project: a project file that parses, edge functions under Deno, and migrations named as the CLI names them. Every storage bucket has a policy, and the service role key stays where it belongs."
---

A Supabase project: a project file that parses, edge functions under Deno, and migrations named as the CLI names them. Every storage bucket has a policy, and the service role key stays where it belongs.

Kind: platform. Requires: `postgres`.

## Tools

- deno 2.6.6
- supabase 2.40.7

## Generated configuration

- `.gspot/semgrep/supabase.yml`

## Checks

| Check                                                                                | Stage  | What it finds                                                                                               |
| ------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| [`supabase/config`](/reference/rules/supabase/config/)                               | commit | Checks that the project file parses, and that every function it configures has a folder with an index file. |
| [`supabase/migration-names`](/reference/rules/supabase/migration-names/)             | commit | Checks that every migration is named fourteen digits, an underscore, and snake case words.                  |
| [`supabase/storage-policies`](/reference/rules/supabase/storage-policies/)           | commit | Checks that every storage bucket in the project file has a policy on storage.objects that names it.         |
| [`supabase/admin-key-containment`](/reference/rules/supabase/admin-key-containment/) | commit | Checks that the service role key is named only under tools.supabase.admin_key_paths.                        |
| [`supabase/deno-lint`](/reference/rules/supabase/deno-lint/)                         | commit | Runs deno lint over every edge function, with the function's own deno.json.                                 |
| [`supabase/deno-check`](/reference/rules/supabase/deno-check/)                       | push   | Type checks the entry file of every edge function with deno check.                                          |
| [`supabase/types-fresh`](/reference/rules/supabase/types-fresh/)                     | push   | Compares tools.supabase.types_file with the types the CLI writes from the local database.                   |

## Settings

- `tools.supabase.types_file`: The committed database types file; empty turns the comparison off.
- `tools.supabase.functions_dir`: The folder that holds one folder for each edge function.
- `tools.supabase.admin_key_paths`: The paths that may name the service role key.

## Rule files

- `platform/supabase/SUPABASE.md`
- `runtime/deno/DENO.md`
