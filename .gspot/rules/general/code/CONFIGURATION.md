---
layer: code
kit: rules
title: Configuration
---

# Configuration

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Validate external values

- Parse and validate external configuration before using it. Downstream code receives typed values.
- A missing required value fails startup with the variable's name in the message and never its
  value. A secret has no fallback and no fake default that looks real.
- Parse booleans from an explicit accepted set, numbers with bounds, URLs through the URL parser,
  and lists with a declared separator. Treat an empty required value as missing.

## One owner

<!-- level: all -->

- Every process reads its environment in one configuration owner module. `process.env`,
  `os.environ`, `os.getenv`, `ProcessInfo.processInfo.environment`, `Deno.env`, and `$VAR` reads in
  workflow functions appear nowhere else.
- Parse each value once at startup and expose a typed, immutable configuration object.
- Group constants by domain (`providerConfig`, `retryPolicy`), not in one bag. Do not add a
  hierarchy or a generic configuration owner for one value.

## Files and secrets

- Every environment variable the process reads appears in the committed example file with a
  placeholder value. Keep actual local overrides in an ignored file.
- Public build-time variables (`NEXT_PUBLIC_*`, `VITE_*`) hold nothing secret. They are copied
  into the bundle.
- Local overrides change only the values they name.

## Configuration structure

<!-- level: all -->

- A configuration file (`*.config.*`, `mise.toml`, `config.toml`, `pyproject.toml`) carries data.
  It does not import feature code, compute values, read other files, or branch on the environment.
- Defaults live in the schema that validates the file, not scattered through readers.
- Document every environment variable once with its name, purpose, required status, format,
  and failure behavior.
- State one precedence order in the owner: command-line flag, environment variable, project file,
  default. The owner resolves it; readers never merge sources themselves.
