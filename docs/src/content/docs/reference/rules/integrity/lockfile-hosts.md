---
title: "integrity/lockfile-hosts"
description: "Checks that every URL in a lockfile is HTTPS and points at an allowed registry host."
---

Checks that every URL in a lockfile is HTTPS and points at an allowed registry host.

## Why

A lockfile line that resolves from another host installs code nobody chose, and a review rarely reads lockfiles.

## What to do

Install the package from the registry again, or add the host to tools.dependencies.registry_hosts.

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/lockfile-hosts --paths <glob> --reason "<why>"`.
