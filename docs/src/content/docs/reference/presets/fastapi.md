---
title: "FastAPI"
description: "A FastAPI service: the FastAPI and async rules of Ruff, and no blocking call inside an async function. The OpenAPI document lints and matches the app, and Semgrep reads the request handling."
---

A FastAPI service: the FastAPI and async rules of Ruff, and no blocking call inside an async function. The OpenAPI document lints and matches the app, and Semgrep reads the request handling.

Kind: framework. Requires: `python`.

## Tools

- spectral 6.15.0

## Generated configuration

- `.gspot/spectral.yaml`
- `.gspot/semgrep/fastapi.yml` when the [security preset](/reference/presets/security/) is selected

## Checks

| Check                                                                                  | Stage  | What it finds                                                                               |
| -------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| [`fastapi/openapi-lint`](/reference/rules/fastapi/openapi-lint/)                       | commit | Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules. |
| [`fastapi/openapi-fresh`](/reference/rules/fastapi/openapi-fresh/)                     | push   | Runs the command in tools.openapi.produced_by and fails when it changes the document.       |
| [`fastapi/no-blocking-io-in-async`](/reference/rules/fastapi/no-blocking-io-in-async/) | commit | Refuses time.sleep, the requests library, and a plain open inside an async function.        |

## Settings

- `tools.openapi.document`: The committed OpenAPI document; empty turns both OpenAPI checks off.
- `tools.openapi.produced_by`: The command that writes the OpenAPI document from the app.

## Rule files

- `framework/fastapi/FASTAPI.md`
- `framework/fastapi/RUNTIME.md`
- `shared/http/HTTP.md`
