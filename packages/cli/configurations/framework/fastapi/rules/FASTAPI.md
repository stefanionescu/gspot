# FastAPI

Structure, parameters, schemas, responses, errors, and the runtime of a Python project on FastAPI
and Pydantic v2.

## Structure

<!-- level: all -->

Path operations adapt HTTP input to application calls and results to HTTP output; business logic
lives outside them. One main module creates the `FastAPI` object and wires routers, global
dependencies, middleware, exception handlers, and startup. Routers group related operations under
a prefix that does not end in `/`, and imports use their domain, `items.router` and `users.router`.
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

`Annotated[..., Query(...)]`, `Path`, `Body`, `Header`, `Cookie`, `Form`, `File`, or `Depends`;
a plain scalar supplies a query parameter. A parameter without a default requires a value, even when it
accepts `None`. Constraints such as `max_length` or `ge` belong at the boundary when the public interface requires them. Use a dependency for a check that needs a database or authorization state, not
a validator. Declare fixed routes such as `/users/me` before `/users/{user_id}`, and group
pagination or filter parameters into a query model with `extra="forbid"`.

Forms need `python-multipart`, and one operation never mixes JSON body fields with form fields
or files. Uploads arrive as `UploadFile`, bounded in count and size; `bytes` holds only small
values. Never use a filename as a filesystem path, a content type never proves safety, and never log uploaded
contents.

## Schemas and responses

Pydantic models define the schemas where data enters or leaves. Use separate classes for create, read, and update shapes when
their fields differ. Never return an input with passwords or tokens as the response. Known JSON
shapes use nested models with typed containers. Use `UUID` for identifiers, timezone-aware instants across a
boundary, and `Decimal` for money. A partial update reads
`model_dump(exclude_unset=True)`, merges with the stored value, and validates the complete model,
because `model_copy(update=...)` validates nothing.

The return type defines the public schema; `response_model` serves a returned object of another
shape. A dedicated output model filters fields, never `response_model_exclude`, which still
documents the full model. A response validation failure shows a server bug. Fix the data or
the schema.

## Status codes and errors

Non-default success codes go in the decorator with `fastapi.status` constants: 201 for creation,
202 for accepted work, and 204 for a deliberate empty body. Raise `HTTPException` rather than returning it. Its `detail` supplies a public error message. Existence and
authorization checks answer alike, so responses do not reveal a private resource. Global exception
handlers return the standard error shape and never echo a validation error's body.

## Runtime

- Declare a path operation or dependency `async def` when it awaits async libraries and `def` when it
  calls blocking code; a blocking call inside `async def` stalls the event loop. Run CPU-heavy work in a worker process, not in `async def`.
- Dependencies carry request-scoped concerns: authentication, sessions, pagination, and
  reusable validation. A `yield` dependency owns one resource, cleans up in `finally`, and
  re-raises what it catches.
- Authentication that appears in OpenAPI uses the security utilities. A JSON Web Token (JWT) verifier allows an
  explicit algorithm list and requires `exp` and `sub`.
- `BackgroundTasks` runs small follow-up work after the response; durable or heavy work goes to
  a queue. Middleware holds cross-cutting HTTP behavior only, and the last middleware added runs
  outermost.
- Turn OpenAPI and the interactive docs off unless a typed setting turns them on, and the schema
  exposes no internal or admin routes.

## Testing

Tests cover the HTTP contract through the test client: status codes, bodies, headers, and
authentication. Replace external systems with dependency overrides at the application
boundary. Tests cover the application rather than FastAPI's routing implementation.
