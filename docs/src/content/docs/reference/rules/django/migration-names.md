---
title: "django/migration-names"
description: "Checks that no migration keeps the name Django gave it, such as 0004_auto_20260101_1200."
---

Checks that no migration keeps the name Django gave it, such as 0004_auto_20260101_1200.

## Why

A migration named auto says nothing in a list of forty, and the list is what a person reads during an incident.

## What to do

Rename the file for what it does, such as 0004_add_invoice_due_date, and update every dependency that names it.

## Where it runs

- Preset: [the django preset](/reference/presets/django/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore django/migration-names --paths <glob> --reason "<why>"`.
