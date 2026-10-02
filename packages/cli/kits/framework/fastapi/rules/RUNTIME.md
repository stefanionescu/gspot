---
title: FastAPI Runtime
---

# FastAPI Runtime

Forms and files, JSON encoding, async work, dependencies, security, streaming, background
tasks, middleware, documentation exposure, and tests. Structure and schema rules are in the
FastAPI file. The async rules of Ruff report blocking calls inside `async def` path
operations. Examples are complete modules; their dependency requirements precede the code.

## Forms and files

Form fields use `Annotated[..., Form()]` and uploads `Annotated[..., File()]` or `UploadFile`,
because a plain scalar parameter is a query parameter. `python-multipart` is a declared
dependency whenever an endpoint accepts form data. A form body is URL-encoded unless it
carries files, then multipart, and one path operation never mixes JSON `Body` fields with
`Form` or `File`. Cohesive fields form a Pydantic form model, with `extra="forbid"` where
unknown fields are invalid. External protocols keep their exact field names: OAuth2 password
login receives `username` and `password` as form fields, and a `Form()` alias exists only for
a name that is not a good identifier.

`bytes` parameters hold only small uploads that fit in memory. Images, archives, model
artifacts, and anything unbounded arrive as `UploadFile`. An optional upload is
`UploadFile | None = None`, and a repeated one is `Annotated[list[UploadFile], File()]` with
a bound on count and total size.

In `async def`, `read`, `write`, `seek`, and `close` are awaited; in `def`, `upload.file`
serves libraries that want a file object. Files owned beyond the request are closed on
rejection and success. `UploadFile.filename` is never a filesystem path and
`UploadFile.content_type` is never proof of safety; content is validated at the application
boundary, and the transport enforces its body-size limit before multipart parsing. Uploaded
contents, user-supplied filenames, and sensitive form fields are not logged.

Good:

```python
"""Count uploaded bytes while bounding consumption and closing the file."""

from typing import Annotated

from fastapi import File, FastAPI, UploadFile, HTTPException, status
from pydantic import BaseModel

MAX_UPLOAD_BYTES = 1024 * 1024
CHUNK_BYTES = 64 * 1024


class UploadSummary(BaseModel):
    """Accepted upload size.

    Attributes:
        size: Number of bytes consumed from the uploaded file.

    """

    size: int


app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)


@app.post("/uploads")
async def inspect_upload(upload: Annotated[UploadFile, File()]) -> UploadSummary:
    """Return the size of an upload no larger than one MiB."""
    size = 0
    try:
        while chunk := await upload.read(CHUNK_BYTES):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="Upload exceeds one MiB",
                )
        return UploadSummary(size=size)
    finally:
        await upload.close()
```

## JSON encoding and updates

`jsonable_encoder()` turns models, `datetime`, `date`, `time`, `timedelta`, `UUID`, `Decimal`,
and sets into JSON-compatible Python structures (not a JSON string) before a JSON-only store
or transport; FastAPI already applies it to responses. `PUT` replaces the whole resource, and
the contract says whether omitted fields take defaults or make the request invalid. `PATCH`
makes every patchable field optional and reads `model_dump(exclude_unset=True)`, so an
omitted field is distinct from one set to its default or `None`. It merges with the stored
value and validates the complete model before persistence, in the same owning operation when
concurrent changes matter. One schema never serves create, replace, patch, and read when
their required fields or visibility differ.

## Async and blocking work

A path operation or dependency is `async def` when it awaits async libraries and `def` when
it calls a blocking database, API, filesystem, or SDK library. FastAPI offloads `def` to a
thread and runs both kinds side by side. A blocking call inside `async def` runs on the event
loop thread, including through an ordinary helper, so it moves to a `def` operation or an
explicit thread offload. An undocumented third-party call is blocking until proven
otherwise. Compute-only operations may be `async def`, but model loading, image processing,
and batch inference need a worker, process pool, or task queue, not the keyword.

## Dependencies

Dependencies carry request-scoped concerns: authentication, authorization, pagination,
database sessions, current user, request metadata, and reusable validation. A function
dependency returns a simple value; a class dependency returns a structured object, injected
as `Annotated[CommonQueryParams, Depends()]`. A dependency whose value the operation needs is
a parameter; one that must only run goes in `dependencies=[Depends(...)]` on the operation,
router, or app, never as an unused parameter. Results are cached per request, and
`use_cache=False` is reserved for a dependency that must run twice. Dependency graphs stay
shallow, dependencies may raise `HTTPException`, and business workflows stay out of them. A
dependency-injected value is validated by the dependency, not presumed valid by injection.

A `yield` dependency owns a request-scoped resource: setup before its single `yield`, cleanup
in `finally`, `with` or `async with` around the `yield` when the resource is already a
context manager, and no `contextlib` decorator. An exception it catches is re-raised or
replaced by a deliberate `HTTPException` with its cause preserved, never swallowed.
`Depends(scope="function")` runs cleanup before the response is sent, and a request-scoped
dependency cannot use a function-scoped one during its cleanup.

## Security

Authentication and authorization that appear in OpenAPI use the security utilities.
`OAuth2PasswordBearer` takes a relative `tokenUrl="token"`. `OAuth2PasswordRequestForm`, or
the strict form when `grant_type=password` is enforced, reads the login form. Scopes carry
fine-grained permissions. The token endpoint returns JSON with `access_token` and
`token_type="bearer"`; an unauthorized response is 401 with `WWW-Authenticate: Bearer`.

Passwords are hashed and verified through a current hashing library, never stored plain. An
unknown user and a wrong password produce the same message with consistent timing, for
example by verifying against a dummy hash.

JWTs are signed, not encrypted, so they carry no secrets. They include an expiration built from timezone-aware UTC and a unique `sub`. The
verifier uses an explicit algorithm allowlist and an application-owned key. It requires and
type-checks `exp` and `sub`, checks issuer and audience where they identify the parties, and
maps every library error to the same public 401 before looking up the user. Signing secrets
live outside source, and documentation example keys, hashes, users, and tokens never reach
real code.

## Streaming

A stream serves clients that need items before the sequence completes. JSON Lines carries a
stream of Pydantic items with a declared `Iterable[T]` or `AsyncIterable[T]` return type
matching the producer and its cancellation behavior. Server-Sent Events serve clients that
need event names, IDs, retry values, or browser `EventSource` semantics, through
`EventSourceResponse` and `ServerSentEvent` with `data` for JSON or `raw_data` for
preformatted text, never both. Resumable streams carry event IDs and read `Last-Event-ID`.
Generation stays cancellable and resource-safe. JSON Lines needs FastAPI 0.134.0 and SSE
0.135.0.

Good:

```python
"""Stream public records as JSON Lines and server-sent events."""

from typing import ClassVar
from collections.abc import Iterable

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict
from fastapi.sse import ServerSentEvent, EventSourceResponse


class Item(BaseModel):
    """One public inventory record.

    Attributes:
        name: Display name of the item.

    """

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    name: str


ITEMS = (Item(name="Notebook"), Item(name="Pencil"))
app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)


@app.get("/items")
def stream_items() -> Iterable[Item]:
    """Yield each public item as one JSON line.

    Yields:
        The next inventory record.

    """
    yield from ITEMS


@app.get("/events", response_class=EventSourceResponse)
def stream_events() -> Iterable[ServerSentEvent]:
    """Yield named events with stable identifiers for the fixed inventory.

    Yields:
        The next event containing a public inventory record.

    """
    for index, item in enumerate(ITEMS):
        yield ServerSentEvent(data=item, event="item", id=str(index))
```

## Background tasks and middleware

`BackgroundTasks` from `fastapi` (not Starlette's singular `BackgroundTask`) runs small
in-process follow-up work after the response: an audit event, a warmup marker, short local
cleanup. Heavy, durable, distributed, or restart-surviving work goes to a real queue or
worker, and work the response depends on never runs in the background. Task failures happen
after the response and are logged and monitored at the worker boundary.

Middleware holds cross-cutting HTTP behavior only, never business logic, and yields to a
router or operation dependency when that boundary is narrower. Code before `await
call_next(request)` runs before the operation, and code after it runs before the response
returns. The last middleware added is the outermost: first on the request, last on the
response. Background tasks run after all of it.

Elapsed time uses `time.perf_counter()`.
Custom response headers are deliberate and exposed through CORS when browsers must read them.
Resource cleanup in `yield` dependencies is matched to the selected scope.

## Metadata and docs

OpenAPI output and interactive docs are off by default: `openapi_url=None`, `docs_url=None`,
`redoc_url=None`, gated by a typed configuration flag such as `enable_api_docs` that
defaults to `False` and is read at the application boundary. When enabled, every docs URL is
enabled deliberately at a stable path. The schema exposes no internal endpoints, hidden admin
routes, security details, or environment metadata. An obscure URL is not the control.
A published API sets title, summary, description, version, contact, and license on the
`FastAPI` object, keeps them accurate, and orders tag metadata to order the docs. The
entrypoint is configured in project configuration where the tool supports it:

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

## Testing

Tests follow the repository testing rules and cover the HTTP contract, not FastAPI internals.
They check status codes, bodies, headers, and auth behavior through the test client or an
async HTTP client. External systems are replaced by dependency overrides at the app boundary.
Router, decorator, and app dependencies are tested where they control security or
validation. Streams are consumed far enough to prove their contract, and background tasks are
tested only where their side effect matters. FastAPI's own routing is not under test.
