---
title: "integrity/suppressions"
description: "Counts every inline suppression by form and reports each one that carries no reason; nosemgrep is refused outright."
---

Counts every inline suppression by form and reports each one that carries no reason; nosemgrep is refused outright.

## Why

A suppression without a reason is a finding hidden for good; a census that grows without a baseline update is debt nobody agreed to.

## What to do

Write the reason in the comment (after two dashes for eslint-disable and gspot-ignore, after a colon for ts-expect-error), or fix the finding and drop the suppression.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/suppressions --paths <glob> --reason "<why>"`.
