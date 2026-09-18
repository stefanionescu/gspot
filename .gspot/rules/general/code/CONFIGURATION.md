---
layer: code
preset: rules
title: Configuration
---

# Configuration

## One owner

- Every process reads its environment in one configuration owner module. `process.env`,
  `os.environ`, `os.getenv`, `ProcessInfo.processInfo.environment`, `Deno.env`, and `$VAR` reads in
  workflow functions appear nowhere else.
- The owner parses and validates every value once at startup and exposes a typed, immutable
  configuration object. Everything downstream receives typed values as parameters or imports.
- A missing required value fails startup with the variable's name in the message and never its
  value. A secret has no fallback and no fake default that looks real.
- Parse strings deliberately: booleans from an explicit accepted set, numbers with bounds, URLs
  through the URL parser, lists with a declared separator. An empty string is missing, not a value.
- Group constants by domain (`providerConfig`, `retryPolicy`), not in one bag. Do not add a
  hierarchy or a generic config owner for one value.

## Files

- A configuration file (`*.config.*`, `mise.toml`, `config.toml`, `pyproject.toml`) carries data.
  It does not import feature code, compute values, read other files, or branch on the environment.
- Defaults live in the schema that validates the file, not scattered through readers.
- Every environment variable the process reads is documented once with its name, purpose, required
  status, format, and failure behavior, and appears in the committed example file with a
  placeholder value.
- Public build-time variables (`NEXT_PUBLIC_*`, `VITE_*`) hold nothing secret. They are copied
  into the bundle.

## Precedence

- One precedence order, stated in the owner: command-line flag, environment variable, project file,
  default. The owner resolves it; readers never merge sources themselves.
- Local overrides live in an ignored local file and change nothing but what they name.
