---
title: "integrity/lockfile-fresh"
description: "Checks that every lockfile matches its manifest, by asking the package manager to install from it without changing it."
---

Checks that every lockfile matches its manifest, by asking the package manager to install from it without changing it.

## Why

A lockfile that lags its manifest installs versions nobody reviewed the moment someone runs a plain install.

## What to do

Run the install of the package manager once and commit the lockfile it writes.

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/lockfile-fresh --paths <glob> --reason "<why>"`.
