---
title: FastAPI
---

# FastAPI

Structure, routers, parameters, schemas, responses, and errors for a Python project that uses
FastAPI. Runtime covers forms and files, encoding, async, dependencies, security, streaming,
background tasks, middleware, documentation exposure, and tests. Ruff reports the annotation,
import, and docstring rules; the `openapi/spectral` check reports a schema that drifts
from the routes. Examples are complete modules on FastAPI and Pydantic v2.

## Source decisions

FastAPI parameters carry their metadata through `Annotated[..., Query(...)]`, `Path`, `Body`,
`Depends`, `Header`, `Cookie`, `Form`, and `File`. Request bodies, response bodies, and
documented structured data are Pydantic models, and a path operation returns a value that
matches its declared return type. FastAPI and Starlette primitives are used directly where
they own the HTTP behavior. Database, SDK, and service clients stay out of import-time work.
A dependency, middleware, background task, or router is added only when a plain function is
not enough. Documentation examples with fake secrets, hashes, users, or tokens are never a
production pattern.

## Application structure

<!-- level: all -->

Framework code is organized by boundary: app creation, routers, dependencies, schemas,
security, middleware, and infrastructure. Path operations adapt HTTP input to application
calls and application results to HTTP output; business logic lives outside them. A
nontrivial app spans modules. One main module creates the `FastAPI` object and wires routers,
global dependencies, middleware, exception handlers, metadata, and startup. Router modules
hold related path operations. Shared dependencies sit in a dependencies module or a
domain-owned one, and internal and admin routers sit in clearly named internal packages.

Regular packages carry `__init__.py`. The entrypoint is configured in project configuration
where the deployment tool supports it. The app never depends on the repository root as the
working directory, and nothing patches `sys.path`.

```text
src/
  app/
    __init__.py
    main.py
    dependencies.py
    routers/
      __init__.py
      items.py
      users.py
    internal/
      __init__.py
      admin.py
```

Good:

```python
"""Expose a fixed catalog with validated identifiers and public responses."""

from typing import ClassVar, Annotated

from fastapi import Path, FastAPI, APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict


class Item(BaseModel):
    """Public catalog item.

    Attributes:
        name: Display name of the item.

    """

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    name: str


CATALOG = (Item(name="Notebook"), Item(name="Pencil"))
router = APIRouter(prefix="/items", tags=["items"])


@router.get("/{item_id}")
def get_item(item_id: Annotated[int, Path(ge=0)]) -> Item:
    """Return one catalog item or a public not-found response."""
    if item_id >= len(CATALOG):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return CATALOG[item_id]


app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
app.include_router(router)
```

## Routers

`APIRouter` groups related path operations and carries the shared prefix (never ending in
`/`), tags, dependencies, and default responses; a path operation adds its own only where it
differs. Paths start with `/`. Router modules are imported by domain, `items.router` and
`users.router`, without aliases that hide the owner, and included in a parent before that
parent joins the app. Exposing one router under several prefixes is reserved for an API that
is intentionally published under several groups.

### Router naming

<!-- level: all -->

The router object is named `router` unless the project requires a more specific name.

## Path operations and parameters

Every path operation annotates its parameters and return value so FastAPI can parse,
validate, document, and serialize. Query and body parameters without defaults are required,
including nullable ones; a default makes them optional, and a path parameter is always
required. A parameter that accepts `None` says so in its annotation, with the default in the
signature rather than inside the metadata object. String constraints (`min_length`,
`max_length`, `pattern`) and numeric constraints (`gt`, `ge`, `lt`, `le`) belong at the
boundary when they are part of the contract. Pydantic validators check request values alone;
a check that needs a database, service, filesystem, or authorization state is a dependency.

Fixed routes such as `/users/me` are declared before `/users/{user_id}`, and no two path
operations share a method and path. Documented string choices use a `str, Enum` type, the
`{name:path}` convertor is used only where slashes are valid, and an alias only preserves an
external name that is not a good identifier. A repeatable query parameter is
`Annotated[list[str], Query()]`; a cohesive group such as pagination, filtering, or sorting is
a Pydantic query model, with `extra="forbid"` when unknown parameters are invalid.

Good:

```python
"""Validate a filter preview without accessing a database."""

from typing import ClassVar, Annotated

from fastapi import Query, FastAPI
from pydantic import Field, BaseModel, ConfigDict


class FilterParams(BaseModel):
    """Bounded pagination and tag filters.

    Attributes:
        limit: Maximum number of requested results.
        offset: Number of results to omit before the page.
        tags: Tags selected by the caller.

    """

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")
    limit: int = Field(default=100, gt=0, le=100)
    offset: int = Field(default=0, ge=0)
    tags: list[str] = Field(default_factory=list)


app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)


@app.get("/filters")
def get_filters(filters: Annotated[FilterParams, Query()]) -> FilterParams:
    """Return the validated query values."""
    return filters
```

## Schemas and fields

Pydantic models are boundary schemas. Required fields have no default, and omittable fields
have one; a nullable annotation alone does not make a field optional in v2. Mutable defaults
use `Field(default_factory=...)`, and business workflows and persistence stay outside the
class. Create, read, and update shapes are separate classes when their required, nullable, or
public fields differ. An input schema holding passwords, tokens, or private fields is never
the response schema. `GET` endpoints take no body.

`Body()` moves a singular value from the query string into the body. `Body(embed=True)` wraps
a single model under its parameter name only when the wire contract says so, and several body
parameters document the keyed shape clients send. Partial updates read `model_dump(exclude_unset=True)`, merge with stored values, and
revalidate the complete model, because `model_copy(update=...)` validates nothing.
`jsonable_encoder()` converts models and datetimes for JSON-only storage or transport.

`Field` comes from `pydantic` and governs model attributes; `Query`, `Path`, `Body`, `Header`,
`Cookie`, `Form`, and `File` govern FastAPI parameters. `title`, `description`, `deprecated`,
`examples`, and constraints become JSON Schema and OpenAPI, so no arbitrary extra keywords
are passed. Whole-model examples live in `json_schema_extra`, field examples in
`Field(examples=[...])`, and body examples in `Body(examples=[...])` or `openapi_examples`
when named examples with summaries are needed; the plural `examples` replaces singular
`example`. Examples are valid, current, and free of secrets, internal IDs, hostnames, and
personal data.

## Nested and special types

Known JSON object shapes are nested models, never `dict[str, object]`, and every `list`, `set`,
`frozenset`, `tuple`, and `dict` names its type parameters. A top-level `list[Model]` body
exists only when the contract is a JSON array. `set[T]` expresses uniqueness and still
serializes as an array. A `dict[KeyType, ValueType]` body is for unknown field names, and its
keys arrive as strings that Pydantic converts.

Identifiers are `UUID`, instants that cross a
boundary are timezone-aware `datetime`, and exact quantities such as money are `Decimal`.
URLs and emails use `HttpUrl` and `EmailStr` when validation is part of the contract.
`bytes` holds only small binary values; uploads go through FastAPI file handling. Deeply nested
bodies give way to smaller endpoints or named resources.

## Headers and cookies

A value from a header or cookie is declared with `Header()` or `Cookie()`, because a plain
scalar parameter is a query parameter. `Header()` converts underscores to hyphens, and
`convert_underscores=False` exists only for an external protocol that requires underscores.
A repeated header is `Annotated[list[str] | None, Header()] = None`. Cohesive header or
cookie groups are Pydantic models, with `extra="forbid"` only where the deployment contract
permits it, because proxies and clients add standard headers. Authentication uses the
security utilities, never ad hoc header parameters, and a cookie's session value is validated
by the authentication boundary before it conveys authority. Cookies, authorization headers,
session IDs, and CSRF tokens are never logged, and Swagger UI does not prove cookie behavior.

## Response models

A path operation that returns its public schema uses the return type. `response_model` is
for a returned object that differs from the public shape, and it takes priority over the
annotation. `-> Any` with `response_model=...` is reserved for a boundary where adapting the
object first adds noise without safety. Schema inheritance filters a response only when the
subclass is a true specialization. A `Response` subclass is the annotation when the route
returns one directly. A return type FastAPI cannot turn into a model needs
`response_model=None`, which also documents a route with two outcomes such as a redirect or a
mapping.

`response_model_exclude_unset=True` omits unset defaults; `exclude_defaults` and
`exclude_none` only when that omission is the contract. Dedicated output models replace
`response_model_include` and `exclude`, which never serve as security filtering because the
OpenAPI schema still describes the full model. A response validation failure is a server bug:
fix the data or the schema, never the validation.

## Status codes and errors

Non-default success codes go in the decorator's `status_code`, written with `fastapi.status`
constants (or `http.HTTPStatus` where surrounding code uses it), never as function
parameters. 201 marks creation, 202 accepted but incomplete work, and 204 a deliberate empty
body; 204 and 304 carry no body. Ordinary failures are not hand-built 500 responses;
unexpected exceptions surface at the server boundary. `HTTPException` is raised, never
returned. Its `detail` is sanitized and user-facing, free of stack traces, paths, table names,
internal IDs, request bodies, and secrets. Custom headers serve only public protocol
requirements such as authentication challenges or rate limits.

Existence and authorization checks answer consistently so private resources are not
revealed. Global exception handlers live in the application setup and register for
Starlette's `HTTPException` when they must cover framework and extension errors. They return
the standard error shape and never expose `RequestValidationError.body` or a stringified
validation exception. Logging around the
default handlers omits authenticated request bodies and sensitive headers.
