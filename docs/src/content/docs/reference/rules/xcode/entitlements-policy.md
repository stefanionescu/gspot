---
title: "xcode/entitlements-policy"
description: "Checks that every entitlement is on tools.xcode.allowed_entitlements, when the policy holds that list."
---

Checks that every entitlement is on tools.xcode.allowed_entitlements, when the policy holds that list.

## Why

An entitlement is a capability the system grants the app, and a new one deserves a review of its own.

## What to do

Remove the entitlement, or add it to tools.xcode.allowed_entitlements.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity
- Required setting: `tools.xcode.allowed_entitlements`

Turn it off for a path with a reason: `gspot ignore xcode/entitlements-policy --paths <glob> --reason "<why>"`.
