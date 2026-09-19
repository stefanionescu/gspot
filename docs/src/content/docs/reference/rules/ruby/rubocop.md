---
title: "ruby/rubocop"
description: "Runs RuboCop with every cop on, the new ones included, and the complexity ceilings the other languages hold."
---

Runs RuboCop with every cop on, the new ones included, and the complexity ceilings the other languages hold.

## Why

Ruby lets one thing be written ten ways, and a team that reads one way reads faster.

## What to do

Run gspot check --fix for the cops that correct themselves, then read each remaining line; the cop name leads to its page in the RuboCop manual.

## Where it runs

- Preset: [the ruby preset](/reference/presets/ruby/)
- Stage: commit
- Tool: rubocop

Turn it off for a path with a reason: `gspot ignore ruby/rubocop --paths <glob> --reason "<why>"`.
