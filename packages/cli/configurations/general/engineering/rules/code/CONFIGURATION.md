---
title: Configuration
---

# Configuration

## Validate external values

- Parse and validate external configuration before using it. Downstream code receives typed values.
- A missing or invalid value stops startup. The message names the variable and never prints its
  value. A secret has no fallback and no fake default that looks real.
- Parse booleans from an explicit accepted set, numbers with bounds, URLs through the URL parser,
  and lists with a declared separator. Treat an empty required value as missing.

## One owner

<!-- level: all -->

- Each process reads the environment in one module and passes the values in.
- Parse each value once at startup and expose a typed, immutable configuration object.
- Group constants by domain (`providerConfig`, `retryPolicy`), not in one bag. Do not add a
  hierarchy or a generic configuration owner for one value.

## Files and secrets

- Keep actual local overrides in an ignored file.
- Public build-time variables (`NEXT_PUBLIC_*`, `VITE_*`) hold nothing secret. They are copied
  into the bundle.

## Configuration structure

<!-- level: all -->

- A configuration file imports no application code.
- Defaults live in the schema that validates the file, not scattered through readers.
- State one precedence order in the owner: command-line flag, environment variable, project file,
  default. The owner resolves it; readers never merge sources themselves.
