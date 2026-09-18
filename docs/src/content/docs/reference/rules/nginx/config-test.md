---
title: "nginx/config-test"
description: "Runs nginx -t over every main configuration file inside the nginx image. It mounts a throwaway certificate and resolves the upstream names."
---

Runs nginx -t over every main configuration file inside the nginx image. It mounts a throwaway certificate and resolves the upstream names.

## Why

Only nginx knows whether nginx accepts the file, and the other place to learn it is the restart in production.

## What to do

Read the line nginx names. Set tools.nginx.image to the image the deployment runs.

## Where it runs

- Preset: [the nginx preset](/reference/presets/nginx/)
- Stage: push
- Tool: docker
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore nginx/config-test --paths <glob> --reason "<why>"`.
