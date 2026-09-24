---
title: Run your first JavaScript check
description: Find a private environment read in a client module, correct it, and rerun ESLint.
---

Start with [the JavaScript walkthrough](/guides/client-environment/). It runs the gspot ESLint
plugin against a small client module, reports the exact line that reads private configuration,
and checks the corrected module.

## What you will check

This client module reads a variable intended for the server:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

The `gspot/no-client-environment` rule reports the read at line 2, column 25. Change the
client to use an API route:

```javascript
"use client";
export const endpoint = "/api/search";
```

The corrected module produces no finding from this rule. An application still needs to
implement that route on the server, where it can read private configuration.

## Run the example

The [walkthrough](/guides/client-environment/) includes the complete setup, ESLint
configuration, commands, and expected output. It uses a disposable directory and the plugin
built from your [source checkout](/guides/install/). No published gspot package is required.

## Check your repository

After trying the example, follow [adopt an existing repository](/guides/existing-repository/)
to select configurations and review generated configuration. The JavaScript configuration runs ESLint and
other checks; the walkthrough selects one rule so its result is easy to inspect.

See [edit and retain repository files](/guides/generated-files/) for what to commit,
regenerate, and keep for restoration.
