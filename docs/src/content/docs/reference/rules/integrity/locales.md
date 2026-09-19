---
title: "integrity/locales"
description: "Checks the message files under tools.i18n.translations: each message parses, none is empty, no key holds a dot, and every locale holds every key of the base."
---

Checks the message files under tools.i18n.translations: each message parses, none is empty, no key holds a dot, and every locale holds every key of the base.

## Why

A key missing in one locale shows the key itself, or another language, in the middle of a translated screen.

## What to do

Correct the message, or add the missing key to the locale.

## Where it runs

- Preset: [the i18n preset](/reference/presets/i18n/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/locales --paths <glob> --reason "<why>"`.
