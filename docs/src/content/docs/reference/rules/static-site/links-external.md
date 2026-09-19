---
title: "static-site/links-external"
description: "Follows every link of the built site, the ones that leave it included."
---

Follows every link of the built site, the ones that leave it included.

## Why

Other sites move their pages, and a link nobody rechecks rots.

## What to do

Update the link. Skip a host that refuses crawlers under tools.linkinator.skip with a reason.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: manual
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/links-external --paths <glob> --reason "<why>"`.
