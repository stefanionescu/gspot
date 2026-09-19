---
title: "django/migrations-fresh"
description: "Runs makemigrations --check, which fails when a model changed and no migration records it."
---

Runs makemigrations --check, which fails when a model changed and no migration records it.

## Why

A model that differs from its migrations works on the machine that ran migrate by hand and nowhere else.

## What to do

Run python manage.py makemigrations, name the migration, and commit it.

## Where it runs

- Preset: [the django preset](/reference/presets/django/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore django/migrations-fresh --paths <glob> --reason "<why>"`.
