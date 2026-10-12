# Configuration

## Validate external values

- A missing or invalid value stops startup. The message names the variable and never prints its
  value.
- Parse booleans from an explicit accepted set, numbers with bounds, URLs through the URL parser,
  and lists with a declared separator. Treat an empty required value as missing.

## Reading configuration

<!-- level: all -->

- Each process reads the environment in one module and passes the values in.
- Parse each value once at startup and expose a typed, immutable configuration object.
- Do not add a hierarchy or a generic configuration module for one value.

## Configuration structure

<!-- level: all -->

- A configuration file imports no application code.
- Defaults live in the schema that validates the file, not scattered through readers.
- State one precedence order in the configuration module: command-line flag, environment variable, project file,
  default. That module resolves it; readers never merge sources themselves.
