---
title: "integrity/install-policy"
description: "Checks that the install configuration waits out a minimum release age, and names the security scanner the policy asks for."
---

Checks that the install configuration waits out a minimum release age, and names the security scanner the policy asks for.

## Why

Most malicious releases are pulled within days, so a package nobody installs in its first week rarely harms anybody.

## What to do

Set [install] minimumReleaseAge in bunfig.toml to the seconds the message names, and the scanner under [install.security].

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/install-policy --paths <glob> --reason "<why>"`.
