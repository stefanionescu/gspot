---
title: FastAPI
---

# FastAPI

Structure, parameters, schemas, responses, errors, and the runtime of a Python project on FastAPI
and Pydantic v2.

## Structure

<!-- level: all -->

Path operations adapt HTTP input to application calls and results to HTTP output; business logic
lives outside them. One main module creates the `FastAPI` object and wires routers, global
dependencies, middleware, exception handlers, and startup. Routers group related operations under
a prefix that does not end in `/`, and are imported by domain, `items.router` and `users.router`.
Database, SDK, and service clients stay out of import-time work, and nothing patches `sys.path`.

```python
"""Expose a fixed catalog with validated identifiers and public responses."""

from typing import Annotated

from fastapi import Path, FastAPI, APIRouter, HTTPException, status
from pydantic import BaseModel


class Item(BaseModel):
    """Public catalog item."""

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

## Parameters

Every parameter and return value is annotated, and parameter metadata goes through
`Annotated[..., Query(...)]`, `Path`, `Body`, `Header`, `Cookie`, `Form`, `File`, or `Depends`;
a plain scalar is a query parameter. A parameter without a default is required, even when it
accepts `None`. Constraints such as `max_length` or `ge` belong at the boundary when they are
part of the contract. A check that needs a database or authorization state is a dependency, not
a validator. Declare fixed routes such as `/users/me` before `/users/{user_id}`, and group
pagination or filter parameters into a query model with `extra="forbid"`.

Forms need `python-multipart`, and one operation never mixes JSON body fields with form fields
or files. Uploads arrive as `UploadFile`, bounded in count and size; `bytes` holds only small
values. A filename is never a filesystem path, a content type never proves safety, and uploaded
contents are not logged.

## Schemas and responses

Pydantic models are boundary schemas: create, read, and update shapes are separate classes when
their fields differ, and an input with passwords or tokens is never the response. Known JSON
shapes are nested models with typed containers, identifiers are `UUID`, instants crossing a
boundary are timezone-aware, and money is `Decimal`. A partial update reads
`model_dump(exclude_unset=True)`, merges with the stored value, and validates the complete model,
because `model_copy(update=...)` validates nothing.

The return type is the public schema; `response_model` serves a returned object of another
shape. A dedicated output model filters fields, never `response_model_exclude`, which still
documents the full model. A response validation failure is a server bug to fix in the data or
the schema.

## Status codes and errors

Non-default success codes go in the decorator with `fastapi.status` constants: 201 for creation,
202 for accepted work, and 204 for a deliberate empty body. `HTTPException` is raised, never
returned, and its `detail` is a public error message. Existence and
authorization checks answer alike, so a private resource is not revealed. Global exception
handlers return the standard error shape and never echo a validation error's body.

## Runtime

- A path operation or dependency is `async def` when it awaits async libraries and `def` when it
  calls blocking code; a blocking call inside `async def` stalls the event loop. Heavy compute
  such as model loading goes to a worker, not the keyword.
- Dependencies carry request-scoped concerns: authentication, sessions, pagination, and
  reusable validation. A `yield` dependency owns one resource, cleans up in `finally`, and
  re-raises what it catches.
- Authentication that appears in OpenAPI uses the security utilities. Passwords are hashed, an
  unknown user and a wrong password get the same answer, and a JWT verifier allows an explicit
  algorithm list and requires `exp` and `sub`.
- `BackgroundTasks` runs small follow-up work after the response; durable or heavy work goes to
  a queue. Middleware holds cross-cutting HTTP behavior only, and the last middleware added runs
  outermost.
- OpenAPI and the interactive docs are off unless a typed setting turns them on, and the schema
  exposes no internal or admin routes.

## Testing

Tests cover the HTTP contract through the test client: status codes, bodies, headers, and
authentication. External systems are replaced by dependency overrides at the application
boundary, and FastAPI's own routing is not under test.
