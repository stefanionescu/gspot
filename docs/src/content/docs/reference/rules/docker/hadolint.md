---
title: "docker/hadolint"
description: "Lints every Dockerfile, and runs ShellCheck over its RUN lines."
---

Lints every Dockerfile, and runs ShellCheck over its RUN lines.

## Why

An unpinned base image or a cache left in a layer makes a build nobody can repeat and an image larger than it needs to be.

## What to do

Change the instruction the way the rule says. Turn one rule off with gspot ignore docker/hadolint --rule <id> --reason.

## Where it runs

- Preset: [the docker preset](/reference/presets/docker/)
- Stage: commit
- Tool: hadolint

Turn it off for a path with a reason: `gspot ignore docker/hadolint --paths <glob> --reason "<why>"`.
