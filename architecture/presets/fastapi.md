# `fastapi`

Kind: framework. Requires: python. Recommends: security, pytest.

## Detects and claims

|                         |                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | `fastapi` in `pyproject.toml` dependencies                                                                                                   |
| Claims                  | nothing by path                                                                                                                              |
| Architecture it assumes | `APIRouter` composition, `Depends` injection, Pydantic models at the boundary, lifespan handlers: what the framework's own tutorial produces |

## Tools

spectral, the Semgrep Python and API packs; Ruff `ASYNC` and `FAST` families.

## Generated configuration

`.gspot/ruff.toml` gains `FAST` (FastAPI rules) and keeps `ASYNC`. The import-linter contracts
gain `[architecture.contracts]` entries the repository declares.

## Checks

| Id                                  | Stage  | Command                                                                   |
| ----------------------------------- | ------ | ------------------------------------------------------------------------- |
| `python/ruff`                       | commit | with `FAST001`, `FAST002`, `FAST003`                                      |
| `fastapi/openapi-fresh`             | push   | the exported OpenAPI document matches the app (`[tools.openapi] command`) |
| `fastapi/openapi-lint`              | commit | `spectral lint`                                                           |
| `security/semgrep`                  | push   | the Python pack plus the API pack                                         |
| `structure/no-blocking-io-in-async` | commit | ast-grep: `time.sleep`, `requests.*`, `open()` inside `async def`         |

## Settings

`tools.openapi.document`, `tools.openapi.command`, `architecture.contracts`.

## Rule files

`framework/fastapi/FASTAPI.md`, `framework/fastapi/RUNTIME.md`, `shared/http/HTTP.md`.
