---
title: "docker/dockerignore"
description: "Checks that an ignore file sits beside every Dockerfile and keeps the git folder, installed dependencies, and environment files out of the build."
---

Checks that an ignore file sits beside every Dockerfile and keeps the git folder, installed dependencies, and environment files out of the build.

## Why

Without it the whole folder goes to the daemon, and copying the folder puts the history and the secrets into the image.

## What to do

Add a .dockerignore beside the Dockerfile with the entries the message names.

## Where it runs

- Preset: [the docker preset](/reference/presets/docker/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore docker/dockerignore --paths <glob> --reason "<why>"`.
