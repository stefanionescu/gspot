# `express`

Kind: framework. Requires: typescript or javascript.

## Detects and claims

|                         |                                                                             |
| ----------------------- | --------------------------------------------------------------------------- |
| Detect                  | `express` in dependencies                                                   |
| Claims                  | nothing by path; adds rules to the scope's JavaScript checks                |
| Architecture it assumes | none. Routers, handlers and middleware live wherever the project puts them. |

## Tools

spectral (for an OpenAPI document when one exists), the Semgrep API rule pack.

## Generated configuration

The scope's ESLint config gains `n/no-process-exit`, `security/*`, and three `no-restricted-syntax` selectors from the prose plan. The selectors say that error messages start uppercase, client messages carry no interpolated identifiers, and log calls take a stable message and a fields object. Boundaries from `[architecture]` when the scope declares elements.

`.gspot/spectral.yaml` extends `spectral:oas` when an OpenAPI file is declared.

## Checks

| Id                              | Stage  | Command                                                                                                                                              |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security/semgrep` express pack | push   | raw query interpolation, `res.send` of raw input, unvalidated redirect, and auth routes with no rate limit; the Node rules ship in `security` (D-94) |
| `express/openapi-lint`          | commit | `spectral lint --ruleset .gspot/spectral.yaml <document>` when `[tools.openapi] document` is set                                                     |
| `express/openapi-fresh`         | push   | the generator in `[tools.openapi] produced_by` leaves the document unchanged                                                                         |
| `express/routes-tested`         | push   | every route file has a test file that names it (through `[tools.express] route_glob` and `test_glob`)                                                |

## Settings

`tools.openapi.document`, `tools.openapi.produced_by`, `tools.express.route_glob`,
`tools.express.test_glob`, `architecture.*` as nextjs.

## Rule files

`framework/express/EXPRESS.md`, `framework/express/API.md`, `framework/express/OPENAPI.md`,
`shared/http/HTTP.md`, `runtime/node/NODE.md`.
