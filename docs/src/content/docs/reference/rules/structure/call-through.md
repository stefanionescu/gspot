---
title: "structure/call-through"
description: "Finds a shell function whose whole body forwards its arguments to one command."
---

Finds a shell function whose whole body forwards its arguments to one command.

## Why

A forwarding function is a second name for the command it wraps.

## What to do

Call the command directly, or allow the function with a reason under structure.call_through_allowed.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/call-through --paths <glob> --reason "<why>"`.
