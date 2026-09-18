---
title: "docker/compose-config"
description: "Asks Docker Compose to parse every Compose file, which needs no running daemon."
---

Asks Docker Compose to parse every Compose file, which needs no running daemon.

## Why

A Compose file that is valid YAML can still name a key Compose refuses, and the first person to learn that is deploying.

## What to do

Read the message Compose prints; it names the key and the service.

## Where it runs

- Preset: [the docker preset](/reference/presets/docker/)
- Stage: push
- Tool: docker

Turn it off for a path with a reason: `gspot ignore docker/compose-config --paths <glob> --reason "<why>"`.
