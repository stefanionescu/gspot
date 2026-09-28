---
layer: framework
kit: fastapi
title: FastAPI Runtime
---

# FastAPI Runtime

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Forms and files, JSON encoding, async work, dependencies, security, streaming, background tasks,
middleware, documentation exposure, and tests. Structure and schema rules are in the FastAPI file.

The executable examples are complete modules. Their dependency requirements
appear before the code. Use nonblocking operations inside async handlers.

## FastAPI forms and files

Rules:

- Use `Form()` for values that must be read from form fields.
- Use `File()` and `UploadFile` for uploaded files.
- Do not rely on plain scalar parameters for form fields. FastAPI treats plain
  non-path scalar parameters as query parameters.
- Use `Annotated[..., Form()]` and `Annotated[..., File()]` for new code.
- Declare `python-multipart` as a project dependency when any endpoint accepts
  form data or file uploads.
- Remember that form bodies use `application/x-www-form-urlencoded` unless they
  include files.
- Remember that file uploads use `multipart/form-data`.
- Do not combine JSON `Body` fields with `Form` or `File` parameters in one path
  operation. A single request body cannot be both JSON and multipart form data.
- Use Pydantic form models for cohesive groups of related form fields.
- Use `model_config = {"extra": "forbid"}` on form models when unknown form
  fields are invalid for that endpoint.
- Use exact form field names required by external protocols. OAuth2 password
  flow login receives `username` and `password` form fields, not JSON.
- Use aliases in `Form()` only when the external form field name cannot be a
  good Python identifier.
- Use `bytes` file parameters only for small uploads that are safe to load
  fully into memory.
- Use `UploadFile` for images, videos, archives, model artifacts, large binary
  files, or any upload whose size is not tightly bounded.
- Use `Annotated[UploadFile, File(...)]` when an uploaded file needs FastAPI
  metadata such as description or validation metadata.
- Use `UploadFile | None = None` or `Annotated[bytes | None, File()] = None`
  for optional uploads.
- Use `list[UploadFile]` or `Annotated[list[UploadFile], File()]` for multiple
  uploads from the same form field.
- Await `UploadFile.read()`, `write()`, `seek()`, and `close()` inside
  `async def`.
- In normal `def` path operations, use `upload.file` directly when a library
  expects a file-like object.
- Close uploaded files when ownership extends beyond FastAPI's request
  lifecycle.
- Do not trust `UploadFile.filename` for filesystem paths. Sanitize or replace
  client-provided filenames before storage.
- Do not trust `UploadFile.content_type` as proof of file safety. Validate file
  content at the application boundary when it matters.
- Do not log uploaded file contents, full filenames containing user data, or
  sensitive form fields.

An OAuth2 password-flow endpoint accepts the protocol's `username` and
`password` form fields. Use the security dependency that expresses that
protocol, then pass the credentials to the authentication owner.

Use a Pydantic form model for a cohesive set of fields. Decide whether extra
fields are invalid for that endpoint, and keep secrets out of model logging
and public response models.

The following complete application counts a bounded upload without trusting its
filename or content type. Declare `python-multipart` alongside FastAPI in the
project dependencies. The request transport must also enforce its body-size
limit before multipart parsing.

Good upload:

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

Use `Annotated[list[UploadFile], File()]` for a repeated file field. Bound
both the number of uploads and their total accepted size, and close every
owned file on rejection as well as success.

## FastAPI JSON encoding and updates

Rules:

- Use `jsonable_encoder()` when data must be converted to JSON-compatible
  Python structures before storage or transport outside FastAPI's response
  handling.
- Do not use `jsonable_encoder()` only to return ordinary responses. FastAPI
  already uses it internally for response serialization.
- Remember that `jsonable_encoder()` returns Python data structures such as
  dictionaries, lists, strings, numbers, booleans, and `None`. It does not
  return a JSON string.
- Use `jsonable_encoder()` before writing Pydantic models, `datetime`,
  `date`, `time`, `timedelta`, `UUID`, `Decimal`, sets, or nested models to
  storage layers that only accept JSON-compatible data.
- Use `PUT` for full replacement semantics.
- Be explicit that a `PUT` body can replace omitted stored values with schema
  defaults.
- Use `PATCH` for partial-update semantics when clients may send only fields
  they want to change.
- Partial-update schemas make every patchable field optional.
- For partial updates, use `.model_dump(exclude_unset=True)` to distinguish
  omitted fields from fields explicitly set to defaults or `None`.
- Validate merged patch values against the complete stored model when cross-field constraints
  can change. `.model_copy(update=...)` does not validate the update.
- Convert the updated model with `jsonable_encoder()` before saving it to a
  JSON-only store.
- Do not apply `model_dump()` without `exclude_unset=True` for partial updates.
  That can overwrite stored values with model defaults.
- Do not use one schema for create, replace, patch, and read operations when
  those operations have different required fields or visibility rules.

`jsonable_encoder(model)` produces JSON-compatible Python values. Pass that
result to a JSON-only storage boundary; do not assume it is a serialized
JSON string.

A full replacement validates the supplied replacement model, then stores the
complete accepted value. Document whether omitted fields take defaults or
make the request invalid.

A partial update extracts supplied fields with `exclude_unset=True`, merges
them with stored values, then validates the complete result. Keep validation
and persistence in the same owning operation when concurrent changes matter.

## FastAPI async and blocking work

Rules:

- Use `async def` for path operations and dependencies that await async
  libraries.
- Use normal `def` for path operations and dependencies that call blocking
  synchronous libraries for database, API, filesystem, or SDK work.
- Do not call blocking I/O directly inside an `async def` path operation.
- If the blocking call must stay in async code, isolate it behind an explicit
  thread offload or move it to a normal `def` dependency or path operation.
- Lightweight compute-only path operations may use `async def`.
- When unsure whether a third-party call blocks, treat it as blocking until the
  library documents an awaitable API.
- Mix `def` and `async def` path operations and dependencies freely; FastAPI runs each correctly.
- Remember that ordinary utility functions are called exactly as written.
  FastAPI only manages `def` versus `async def` behavior for callables it
  invokes as path operations or dependencies.
- Do not make CPU-bound model loading, quantization, image processing, or batch inference
  asynchronous by only adding `async def`. Use a worker, process pool, task
  queue, or other explicit execution boundary.

Await an asynchronous client inside an `async def` endpoint. A function name
or return annotation alone does not make the underlying I/O asynchronous.

Put a blocking repository call in a normal `def` endpoint or dependency so
FastAPI owns the thread offload. A normal helper called from `async def`
still runs directly on the event-loop thread.

## FastAPI dependencies

Rules:

- Use dependencies for request-scoped concerns such as authentication,
  authorization, pagination parameters, database sessions, current user lookup,
  request metadata, and reusable request validation.
- A dependency is any callable FastAPI can call and inspect.
- Prefer function dependencies for simple reusable values or validation.
- Use class dependencies when the dependency returns a structured object that
  improves type checking and editor support.
- When using a class dependency, prefer
  `Annotated[CommonQueryParams, Depends()]` when the shortcut is clear.
- Use a dependency parameter when the path operation needs the returned value.
- Use `dependencies=[Depends(...)]` on a path operation, router, or app when the
  dependency must run but its value is not used.
- Put dependencies shared by a router on the `APIRouter`.
- Put dependencies that apply to every path operation on the `FastAPI` app.
- Keep dependency graphs understandable. Deep sub-dependency trees need a clear
  ownership reason.
- FastAPI caches dependency results per request by default. Use
  `use_cache=False` only when the same dependency must intentionally run more
  than once in one request.
- Dependencies may raise `HTTPException`.
- Do not add unused dependency parameters to path operation functions just to
  force execution. Use decorator, router, or app dependencies instead.
- Do not hide business workflows in dependencies.

Inject the verified current user through `Annotated[User, Depends(...)]`
when the endpoint needs that value. Authentication must complete before the
dependency returns a trusted user.

Use `dependencies=[Depends(...)]` for required checks whose return values
are unused. A custom token-header comparison is not a substitute for the
application's declared authentication scheme.

A class dependency can own validated pagination values. Annotate its
constructor and apply the same bounds as a query model; dependency injection
does not establish validity by itself.

## FastAPI dependencies with yield

Rules:

- Use `yield` dependencies for request-scoped resource lifetime, such as
  database sessions, transactions, temporary files, and client sessions.
- A dependency with `yield` uses exactly one `yield`.
- Put setup before `yield`.
- Put cleanup in `finally`.
- The yielded value is injected into path operations and dependent dependencies.
- A dependency with `yield` may be `def` or `async def`.
- If a `yield` dependency catches an exception, it must re-raise the same
  exception or raise a deliberate replacement such as `HTTPException`.
- Do not swallow exceptions in `yield` dependencies.
- Prefer ordinary `with` or `async with` inside a `yield` dependency when a
  resource is already a context manager.
- Do not decorate FastAPI dependencies with `@contextlib.contextmanager` or
  `@contextlib.asynccontextmanager`; FastAPI handles that internally.
- Use `Depends(scope="function")` only when cleanup must happen after the path
  operation returns but before the response is sent.
- A request-scoped dependency cannot depend on a function-scoped dependency if
  it needs that dependency during cleanup.

Acquire the request-scoped resource before the dependency's single `yield`.
Close it in `finally` so cleanup runs after both success and failure.

If a yield dependency translates an owned exception, preserve its cause and
raise the deliberate public error. Let unrelated failures propagate through
the resource cleanup.

Use a resource's `with` or `async with` boundary around `yield` when that
resource is already a context manager. Do not add a second context-manager
decorator to the FastAPI dependency.

## FastAPI security

Rules:

- Use FastAPI security utilities for authentication and authorization that
  appears in OpenAPI.
- Use `OAuth2PasswordBearer` for bearer-token dependencies when that is the
  chosen security scheme.
- Use a relative `tokenUrl`, such as `tokenUrl="token"`.
- Use `OAuth2PasswordRequestForm` for OAuth2 password-flow login forms.
- Use `OAuth2PasswordRequestFormStrict` when `grant_type=password` must be
  enforced.
- Login endpoints for OAuth2 password flow receive username and password as form
  data, not JSON.
- Token endpoints return JSON with `access_token` and `token_type`.
- Bearer token responses use `token_type="bearer"`.
- Unauthorized bearer-token responses use HTTP 401 and include
  `WWW-Authenticate: Bearer`.
- Never store plaintext passwords.
- Hash passwords with a current password-hashing library and a recommended
  algorithm.
- Verify passwords through the password-hashing library.
- When authentication fails, use the same public error message for unknown user
  and wrong password.
- Reduce username enumeration risk by keeping failure timing consistent where
  practical, such as verifying against a dummy hash for unknown users.
- JWT tokens are signed, not encrypted. Do not put secrets or sensitive data in
  JWT payloads.
- JWT access tokens include an expiration.
- Use timezone-aware UTC datetimes when creating expirations.
- Use the JWT `sub` own for a unique application-wide subject string when JWTs
  identify users or entities.
- Store signing secrets outside source code.
- Do not use documentation example secret keys, fake hashes, fake users, or fake
  token logic in real code.
- Catch token verification errors from the JWT library and convert them to a
  generic credentials error.
- Use scopes for fine-grained permissions when the API needs them.
- Prefer integrated security dependencies over custom header checks for real
  authentication.

Configure the token verifier with an explicit algorithm allowlist and the
application-owned signing key or key set. Require expiration and subject
owns, validate their types, and verify issuer and audience when those owns
identify the accepted source and recipient. Map verification failures to the
same public 401 challenge before looking up an authorized user.

The verifier's library owns token decoding and own checks. See
[PyJWT own validation](https://pyjwt.readthedocs.io/en/latest/usage.html)
when the application uses PyJWT.

A successful OAuth2 token response has `access_token` and
`token_type="bearer"`. Keep credential verification and token issuance in their
existing owners. Do not demonstrate authentication with a hardcoded accepted
password, user, secret, or token.

## FastAPI streaming

Rules:

- Use streaming when the client needs items before the whole sequence
  is available.
- Use JSON Lines for streams of JSON objects.
- Annotate async streaming path operations as `AsyncIterable[T]`.
- Annotate sync streaming path operations as `Iterable[T]`.
- Use Pydantic models for streamed JSON items.
- Prefer a declared return type so FastAPI can validate, filter, serialize, and
  document streamed items.
- Use Server-Sent Events when clients need event names, event IDs, retry values,
  comments, or browser EventSource semantics.
- Use `EventSourceResponse` for SSE endpoints.
- Yield `ServerSentEvent(data=...)` for JSON-encoded SSE data.
- Yield `ServerSentEvent(raw_data=...)` for preformatted text, log lines, or
  sentinel values.
- Do not set both `data` and `raw_data` on the same SSE event.
- Include event IDs when clients need to resume after reconnecting.
- Read `Last-Event-ID` when resumable streams are required.
- SSE can use methods other than GET when the protocol requires it.
- Keep streamed item generation cancellable and resource-safe.

The following complete application streams two fixed records. FastAPI 0.134.0
introduced native [JSON Lines](https://fastapi.tiangolo.com/tutorial/stream-json-lines/),
and 0.135.0 introduced native [server-sent events](https://fastapi.tiangolo.com/tutorial/server-sent-events/).
Use FastAPI 0.135.0 or later for both endpoints.

Good streams:

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
# gspot-ignore python/trivial-function -- FastAPI registers this required streaming callback.
def stream_items() -> Iterable[Item]:
    """Yield each public item as one JSON line.

    Yields:
        The next inventory record.

    """
    yield from ITEMS


@app.get("/events", response_class=EventSourceResponse)
# gspot-ignore python/trivial-function -- FastAPI registers this required event callback.
def stream_events() -> Iterable[ServerSentEvent]:
    """Yield named events with stable identifiers for the fixed inventory.

    Yields:
        The next event containing a public inventory record.

    """
    for index, item in enumerate(ITEMS):
        yield ServerSentEvent(data=item, event="item", id=str(index))
```

A synchronous streaming operation returns `Iterable[T]`; an asynchronous
operation returns `AsyncIterable[T]`. Choose the form that matches the
underlying producer and its cancellation behavior.

The event endpoint declares `EventSourceResponse` and yields
`ServerSentEvent` values. Its identifiers are stable because the demonstration
inventory is fixed. A changing inventory needs durable event identity and
explicit replay behavior.

Use `raw_data` only when the event payload is already the intended text.
Use `data` for JSON encoding. Never supply both fields on one event.

## FastAPI background tasks

Rules:

- Use `BackgroundTasks` for small follow-up work that can run after the response
  is sent and stays in the same process.
- Typical uses include recording a warmup marker, writing a small audit event,
  or doing short local cleanup.
- Do not use `BackgroundTasks` for heavy computation, durable jobs, distributed
  work, long-running tasks, or work that must survive process restarts.
- Use a real job queue or worker system for heavy or durable background work.
- Import `BackgroundTasks` from `fastapi`.
- Use `BackgroundTasks`, not Starlette's singular `BackgroundTask`, for
  dependency-injected path operation parameters.
- Do not put required user-visible work in a background task if the response
  depends on its success.
- Background task failures happen after the response. Log and monitor them at
  the worker boundary.

Queue short follow-up work through `BackgroundTasks.add_task`. The response
does not establish that the task succeeded. Required or durable work belongs
to a boundary that can report or retain its completion state.

## FastAPI middleware

Rules:

- Use middleware for cross-cutting HTTP request and response behavior.
- Middleware receives the request and a `call_next` function.
- Code before `await call_next(request)` runs before the path operation.
- Code after `await call_next(request)` runs after the path operation and before
  returning the response.
- Use `time.perf_counter()` for elapsed-time measurements.
- Add custom response headers deliberately.
- If browser clients must read a custom header, expose it in CORS settings.
- Middleware order matters. The last middleware added is the outermost.
- On the request path, the outermost middleware runs first.
- On the response path, the outermost middleware runs last.
- Request-scoped `yield` dependencies clean up after the response. Function-scoped
  dependencies clean up before it is sent. Match middleware and streaming resource use to
  the selected scope and installed FastAPI version.
- Background tasks run after middleware.
- Keep middleware small. Do not put business logic in middleware.
- Do not use middleware when a router dependency or path operation dependency is
  the narrower correct boundary.

Measure elapsed middleware time with `time.perf_counter`, await
`call_next(request)`, then add the intentional response header. Annotate
`call_next` with its asynchronous request-to-response contract. Expose the
header through CORS only when browser clients need to read it.

## FastAPI metadata and docs

Rules:

- Disable OpenAPI schema output and interactive documentation by default.
- Expose OpenAPI, Swagger UI, or ReDoc only when the product or deployment
  explicitly requires it.
- Gate schema and docs exposure behind a typed configuration value loaded at
  the application boundary, such as an environment-derived `enable_api_docs`
  flag.
- Default that flag to `False`.
- Do not expose docs or schema only because FastAPI enables them by default.
- When docs are disabled, set `openapi_url=None`, `docs_url=None`, and
  `redoc_url=None`.
- When docs are enabled, enable all schema and docs URLs deliberately and keep
  the exposed paths stable.
- Do not expose internal-only endpoints, hidden admin routes, security schemes,
  example payloads, or environment-specific metadata in a public OpenAPI schema.
- Do not rely on obscurity of docs URLs as the control. The schema endpoint is
  the contract exposure that must be explicitly enabled or disabled.
- Configure API metadata on the `FastAPI` object when the API is user-facing or
  published.
- Metadata may include title, summary, description, version, terms of service,
  contact, and license information.
- Keep the metadata accurate. Do not describe endpoints or features that do not
  exist.
- Use tag metadata to group path operations in generated docs.
- The order of tag metadata controls docs display order.
- Use `openapi_url`, `docs_url`, and `redoc_url` deliberately when versioning,
  relocating, exposing, or disabling documentation surfaces.
- Prefer configuring the FastAPI entrypoint in project configuration when the
  tool supports it.

Pass the application's typed documentation setting into its construction
boundary. Set `openapi_url`, `docs_url`, and `redoc_url` explicitly for the
selected exposure. The complete examples keep all three disabled.

Good project configuration:

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

## FastAPI testing

Follow the repository testing rules. Do not add or run tests unless requested.

Rules:

- Test the HTTP contract, not FastAPI internals.
- Use the framework test client or async HTTP client appropriate for the app.
- Assert status codes, response bodies, headers, and auth behavior.
- Override dependencies at the app boundary for external systems.
- Test router-level, decorator-level, and app-level dependencies where they
  control security or request validation.
- Test streaming endpoints by consuming enough items to prove the stream
  contract.
- Test background tasks only when their observable side effect matters.
- Do not test that FastAPI itself routes requests correctly.
