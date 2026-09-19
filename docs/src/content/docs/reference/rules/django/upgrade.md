---
title: "django/upgrade"
description: "Checks that no file uses a form django-upgrade rewrites for the Django version the project targets."
---

Checks that no file uses a form django-upgrade rewrites for the Django version the project targets.

## Why

A deprecated form works until the release that removes it, and that release arrives as one large, urgent change.

## What to do

Run gspot check --fix, which runs django-upgrade over the files, and read the diff.

## Where it runs

- Preset: [the django preset](/reference/presets/django/)
- Stage: commit
- Tool: django-upgrade

Turn it off for a path with a reason: `gspot ignore django/upgrade --paths <glob> --reason "<why>"`.
