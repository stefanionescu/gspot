---
title: "django/migration-reversible"
description: "Checks that every RunPython names its reverse function and every RunSQL names its reverse SQL."
---

Checks that every RunPython names its reverse function and every RunSQL names its reverse SQL.

## Why

A migration with no way back turns a bad deploy into a restore from backup.

## What to do

Pass reverse_code to RunPython and reverse_sql to RunSQL. Pass the noop of RunPython where going back needs no work.

## Where it runs

- Preset: [the django preset](/reference/presets/django/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore django/migration-reversible --paths <glob> --reason "<why>"`.
