---
title: "Express"
description: "An Express service: the Semgrep rules for request handling, an OpenAPI document that lints and matches its source, and a test for every route file."
---

An Express service: the Semgrep rules for request handling, an OpenAPI document that lints and matches its source, and a test for every route file.

Kind: framework. Requires: `javascript`.

## Tools

- spectral 6.15.0

## Generated configuration

- `.gspot/semgrep/express.yml` when the [security preset](/reference/presets/security/) is selected
- `.gspot/spectral.yaml`

## Checks

| Check                                                              | Stage  | What it finds                                                                               |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------- |
| [`express/openapi-lint`](/reference/rules/express/openapi-lint/)   | commit | Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules. |
| [`express/openapi-fresh`](/reference/rules/express/openapi-fresh/) | push   | Runs the command in tools.openapi.produced_by and fails when it changes the document.       |
| [`express/routes-tested`](/reference/rules/express/routes-tested/) | push   | Checks that some test file names every route file.                                          |

## Settings

- `tools.openapi.document`: The committed OpenAPI document; empty turns both OpenAPI checks off.
- `tools.openapi.produced_by`: The command that writes the OpenAPI document from the code.
- `tools.express.route_glob`: The route files that each need a test; empty turns the check off.
- `tools.express.test_glob`: The files that count as tests of a route.

## Rule files

- `framework/express/EXPRESS.md`
- `framework/express/API.md`
- `framework/express/OPENAPI.md`
- `shared/http/HTTP.md`
- `runtime/node/NODE.md`
