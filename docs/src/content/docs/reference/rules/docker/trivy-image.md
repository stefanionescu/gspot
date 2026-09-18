---
title: "docker/trivy-image"
description: "Scans every image a Compose file names for known vulnerabilities in its packages."
---

Scans every image a Compose file names for known vulnerabilities in its packages.

## Why

A base image carries hundreds of packages, and their advisories arrive after the image was chosen.

## What to do

Move to a newer tag of the image. Accept one advisory with a reason under tools.trivy.ignore.

## Where it runs

- Preset: [the docker preset](/reference/presets/docker/)
- Stage: manual
- Tool: trivy
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore docker/trivy-image --paths <glob> --reason "<why>"`.
