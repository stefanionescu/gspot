---
title: "ruby/bundler-audit"
description: "Checks Gemfile.lock against the Ruby advisory database, and the Gemfile for a source over plain HTTP."
---

Checks Gemfile.lock against the Ruby advisory database, and the Gemfile for a source over plain HTTP.

## Why

A gem with a known vulnerability is one the whole world can read the exploit for.

## What to do

Upgrade the gem to a patched version the finding names: run bundle update with the name of the gem.

## Where it runs

- Preset: [the ruby preset](/reference/presets/ruby/)
- Stage: push
- Tool: bundler-audit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore ruby/bundler-audit --paths <glob> --reason "<why>"`.
