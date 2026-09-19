---
title: "static-site/sitemap"
description: "Compares the sitemap with the output: every listed route is a built page, and every built page is listed."
---

Compares the sitemap with the output: every listed route is a built page, and every built page is listed.

## Why

A page outside the sitemap is found late by search engines, and a listed page that does not exist costs trust with them.

## What to do

Add the page to the sitemap, remove the dead entry, or leave a page out under tools.site.sitemap_excluded.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/sitemap --paths <glob> --reason "<why>"`.
