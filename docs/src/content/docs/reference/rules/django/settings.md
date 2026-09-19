---
title: "django/settings"
description: "Checks that no settings module a deploy reads turns DEBUG on, allows every host, or holds the secret key as text."
---

Checks that no settings module a deploy reads turns DEBUG on, allows every host, or holds the secret key as text.

## Why

DEBUG prints settings and source to anyone who causes an error, and a secret key in the repository signs sessions for everyone who can read it.

## What to do

Read DEBUG, ALLOWED_HOSTS, and SECRET_KEY from the environment. Keep development values in a module named local, dev, development, or test.

## Where it runs

- Preset: [the django preset](/reference/presets/django/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore django/settings --paths <glob> --reason "<why>"`.
