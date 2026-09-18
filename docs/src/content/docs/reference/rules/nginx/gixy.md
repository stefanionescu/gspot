---
title: "nginx/gixy"
description: "Reads every nginx file for the mistakes that open a server: request forgery, path traversal through alias, header injection, a disclosed version."
---

Reads every nginx file for the mistakes that open a server: request forgery, path traversal through alias, header injection, a disclosed version.

## Why

These mistakes parse, serve traffic, and look like any other location block until somebody uses them.

## What to do

Change the block the way the rule's page says. Turn one rule off with gspot ignore nginx/gixy --rule <name> --reason.

## Where it runs

- Preset: [the nginx preset](/reference/presets/nginx/)
- Stage: commit
- Tool: gixy

Turn it off for a path with a reason: `gspot ignore nginx/gixy --paths <glob> --reason "<why>"`.
