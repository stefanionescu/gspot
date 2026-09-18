---
title: "docker/trivy-config"
description: "Scans Dockerfiles and Compose files for misconfiguration: a root user, a missing health check, an exposed secret."
---

Scans Dockerfiles and Compose files for misconfiguration: a root user, a missing health check, an exposed secret.

## Why

A container that runs as root turns any bug in the service into control of the container.

## What to do

Change the file the way the message says. Accept one id with a reason under tools.trivy.ignore.

## Where it runs

- Preset: [the docker preset](/reference/presets/docker/)
- Stage: push
- Tool: trivy

Turn it off for a path with a reason: `gspot ignore docker/trivy-config --paths <glob> --reason "<why>"`.
