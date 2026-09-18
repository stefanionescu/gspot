---
layer: code
preset: rules
title: Configuration
---

# Configuration

## One owner

- Every process reads its environment in one configuration owner module. `process.env`,
  `os.environ`, `os.getenv`, `ProcessInfo.processInfo.environment`, `Deno.env`, and `$VAR` reads in
  workflow functions appear nowhere else. `enforced-by: structure/env-access-owner`
- The owner parses and validates every value once at startup and exposes a typed, immutable
  configuration object. Everything downstream receives typed values as parameters or imports. `unenforced`
- A missing required value fails startup with the variable's name in the message and never its
  value. There is no fallback for a secret and no fake default that looks real. `enforced-by: security/semgrep`
- Parse strings deliberately: booleans from an explicit accepted set, numbers with bounds, URLs
  through the URL parser, lists with a declared separator. An empty string is missing, not a value. `unenforced`
- Group constants by domain (`providerConfig`, `retryPolicy`), not in one bag. Do not add a
  hierarchy or a generic config owner for one value. `unenforced`

## Files

- A configuration file (`*.config.*`, `mise.toml`, `config.toml`, `pyproject.toml`) carries data.
  It does not import feature code, compute values, read other files, or branch on the environment. `enforced-by: integrity/config-purity`
- Defaults live in the schema that validates the file, not scattered through readers. `unenforced`
- Every environment variable the process reads is documented once with its name, purpose, required
  status, format, and failure behavior, and appears in the committed example file with a
  placeholder value. `enforced-by: config-files/env-example`
- Public build-time variables (`NEXT_PUBLIC_*`, `VITE_*`) hold nothing secret. They are copied
  into the bundle. `enforced-by: typescript/eslint gspot/no-client-environment`

## Precedence

- One precedence order, stated in the owner: command-line flag, environment variable, project file,
  default. The owner resolves it; readers never merge sources themselves. `unenforced`
- Local overrides live in an ignored local file and change nothing but what they name. `unenforced`
