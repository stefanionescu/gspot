---
title: "Django"
description: "A Django project: the Django rules of Ruff, django-upgrade for the version the project targets, migrations that are named, reversible, and current, and settings that are safe to deploy."
---

A Django project: the Django rules of Ruff, django-upgrade for the version the project targets, migrations that are named, reversible, and current, and settings that are safe to deploy.

Kind: framework. Requires: `python`.

## Tools

- django-upgrade 1.32.0

## Checks

| Check                                                                          | Stage  | What it finds                                                                                                     |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| [`django/upgrade`](/reference/rules/django/upgrade/)                           | commit | Checks that no file uses a form django-upgrade rewrites for the Django version the project targets.               |
| [`django/migration-names`](/reference/rules/django/migration-names/)           | commit | Checks that no migration keeps the name Django gave it, such as 0004_auto_20260101_1200.                          |
| [`django/migration-reversible`](/reference/rules/django/migration-reversible/) | commit | Checks that every RunPython names its reverse function and every RunSQL names its reverse SQL.                    |
| [`django/settings`](/reference/rules/django/settings/)                         | commit | Checks that no settings module a deploy reads turns DEBUG on, allows every host, or holds the secret key as text. |
| [`django/migrations-fresh`](/reference/rules/django/migrations-fresh/)         | push   | Runs makemigrations --check, which fails when a model changed and no migration records it.                        |

## Settings

- `tools.django.target_version`: The Django version django-upgrade rewrites for. auto reads it from the dependencies in pyproject.toml.

## Rule files

- `framework/django/DJANGO.md`
