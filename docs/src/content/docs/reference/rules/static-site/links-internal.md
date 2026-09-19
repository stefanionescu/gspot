---
title: "static-site/links-internal"
description: "Serves the built site and follows every link between its pages, stylesheets, and fragments."
---

Serves the built site and follows every link between its pages, stylesheets, and fragments.

## Why

A broken internal link is a dead end a visitor finds before the author does.

## What to do

Fix the link, or the page it points at.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/links-internal --paths <glob> --reason "<why>"`.
