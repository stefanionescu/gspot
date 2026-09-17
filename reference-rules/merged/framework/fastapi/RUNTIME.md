---
layer: framework
preset: fastapi
title: FastAPI Runtime
---

# FastAPI Runtime

Forms and files, JSON encoding, async work, dependencies, security, streaming, background tasks,
middleware, documentation exposure, and tests. Structure and schema rules are in the FastAPI file.

## FastAPI Forms and Files

Rules:

- Use `Form()` for values that must be read from form fields. `unenforced`
- Use `File()` and `UploadFile` for uploaded files. `enforced-by: python/ruff FAST`
- Do not rely on plain scalar parameters for form fields. FastAPI treats plain
  non-path scalar parameters as query parameters. `unenforced`
- Use `Annotated[..., Form()]` and `Annotated[..., File()]` for new code. `unenforced`
- Declare `python-multipart` as a project dependency when any endpoint accepts
  form data or file uploads. `enforced-by: python/ruff FAST`
- Remember that form bodies use `application/x-www-form-urlencoded` unless they
  include files. `unenforced`
- Remember that file uploads use `multipart/form-data`. `enforced-by: python/ruff FAST`
- Do not combine JSON `Body` fields with `Form` or `File` parameters in one path
  operation. A single request body cannot be both JSON and multipart form data. `enforced-by: python/ruff FAST`
- Use Pydantic form models for cohesive groups of related form fields. `enforced-by: python/ruff FAST`
- Use `model_config = {"extra": "forbid"}` on form models when unknown form
  fields are invalid for that endpoint. `unenforced`
- Use exact form field names required by external protocols. OAuth2 password
  flow login receives `username` and `password` form fields, not JSON. `enforced-by: python/ruff FAST`
- Use aliases in `Form()` only when the external form field name cannot be a
  good Python identifier. `enforced-by: python/ruff FAST`
- Use `bytes` file parameters only for small uploads that are safe to load
  fully into memory. `enforced-by: python/ruff FAST`
- Use `UploadFile` for images, videos, archives, model artifacts, large binary
  files, or any upload whose size is not tightly bounded. `enforced-by: python/ruff FAST`
- Use `Annotated[UploadFile, File(...)]` when an uploaded file needs FastAPI
  metadata such as description or validation metadata. `unenforced`
- Use `UploadFile | None = None` or `Annotated[bytes | None, File()] = None`
  for optional uploads. `unenforced`
- Use `list[UploadFile]` or `Annotated[list[UploadFile], File()]` for multiple
  uploads from the same form field. `unenforced`
- Await `UploadFile.read()`, `write()`, `seek()`, and `close()` inside
  `async def`. `enforced-by: python/ruff FAST`
- In normal `def` path operations, use `upload.file` directly when a library
  expects a file-like object. `enforced-by: python/ruff FAST`
- Close uploaded files when ownership extends beyond FastAPI's request
  lifecycle. `unenforced`
- Do not trust `UploadFile.filename` for filesystem paths. Sanitize or replace
  client-provided filenames before storage. `unenforced`
- Do not trust `UploadFile.content_type` as proof of file safety. Validate file
  content at the application boundary when it matters. `unenforced`
- Do not log uploaded file contents, full filenames containing user data, or
  sensitive form fields. `enforced-by: security/semgrep`

Good form fields:

```python
@router.post("/login/")
async def login(
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
) -> Token:
    return authenticate_form_user(username=username, password=password)
```

Good form model:

```python
class LoginForm(BaseModel):
    """Login form fields."""

    model_config = {"extra": "forbid"}

    username: str
    password: str

@router.post("/login/")
async def login(data: Annotated[LoginForm, Form()]) -> Token:
    return authenticate_form_user(username=data.username, password=data.password)
```

Good upload:

```python
@router.post("/images/")
async def upload_image(
    image: Annotated[UploadFile, File(description="Image file.")],
) -> ImageUploadResult:
    return await store_image(image)
```

Good multiple uploads:

```python
@router.post("/images/batch")
async def upload_images(files: Annotated[list[UploadFile], File()]) -> BatchUploadResult:
    return await store_images(files)
```

## FastAPI JSON Encoding and Updates

Rules:

- Use `jsonable_encoder()` when data must be converted to JSON-compatible
  Python structures before storage or transport outside FastAPI's response
  handling. `unenforced`
- Do not use `jsonable_encoder()` only to return ordinary responses. FastAPI
  already uses it internally for response serialization. `unenforced`
- Remember that `jsonable_encoder()` returns Python data structures such as
  dictionaries, lists, strings, numbers, booleans, and `None`. It does not
  return a JSON string. `unenforced`
- Use `jsonable_encoder()` before writing Pydantic models, `datetime`,
  `date`, `time`, `timedelta`, `UUID`, `Decimal`, sets, or nested models to
  storage layers that only accept JSON-compatible data. `enforced-by: python/ruff FAST`
- Use `PUT` for full replacement semantics. `enforced-by: python/ruff FAST`
- Be explicit that a `PUT` body can replace omitted stored values with schema
  defaults. `enforced-by: python/ruff FAST`
- Use `PATCH` for partial-update semantics when clients may send only fields
  they want to change. `enforced-by: python/ruff FAST`
- Partial-update schemas make every patchable field optional. `unenforced`
- For partial updates, use `.model_dump(exclude_unset=True)` to distinguish
  omitted fields from fields explicitly set to defaults or `None`. `unenforced`
- Use `.model_copy(update=...)` to produce an updated Pydantic model without
  mutating the stored model instance. `enforced-by: python/ruff FAST`
- Convert the updated model with `jsonable_encoder()` before saving it to a
  JSON-only store. `unenforced`
- Do not apply `model_dump()` without `exclude_unset=True` for partial updates.
  That can overwrite stored values with model defaults. `unenforced`
- Do not use one schema for create, replace, patch, and read operations when
  those operations have different required fields or visibility rules. `unenforced`

Good JSON-compatible storage:

```python
def save_item(item_id: str, item: ItemOut) -> None:
    item_store[item_id] = jsonable_encoder(item)
```

Good replacement:

```python
@router.put("/items/{item_id}", response_model=ItemOut)
async def replace_item(item_id: str, item: ItemReplace) -> ItemOut:
    encoded_item = jsonable_encoder(item)
    item_store[item_id] = encoded_item
    return ItemOut.model_validate(encoded_item)
```

Good partial update:

```python
@router.patch("/items/{item_id}", response_model=ItemOut)
async def patch_item(item_id: str, item: ItemPatch) -> ItemOut:
    stored_item = ItemOut.model_validate(item_store[item_id])
    update_data = item.model_dump(exclude_unset=True)
    updated_item = stored_item.model_copy(update=update_data)
    item_store[item_id] = jsonable_encoder(updated_item)
    return updated_item
```

## FastAPI Async and Blocking Work

Rules:

- Use `async def` for path operations and dependencies that await async
  libraries. `enforced-by: python/ruff FAST`
- Use normal `def` for path operations and dependencies that call blocking
  synchronous libraries for database, API, filesystem, or SDK work. `enforced-by: python/ruff FAST`
- Do not call blocking I/O directly inside an `async def` path operation. `enforced-by: python/ruff FAST`
- If the blocking call must stay in async code, isolate it behind an explicit
  thread offload or move it to a normal `def` dependency or path operation. `enforced-by: python/ruff FAST`
- Lightweight compute-only path operations may use `async def`. `enforced-by: python/ruff FAST`
- When unsure whether a third-party call blocks, treat it as blocking until the
  library documents an awaitable API. `enforced-by: python/ruff FAST`
- Mix `def` and `async def` path operations and dependencies freely; FastAPI runs each correctly. `enforced-by: python/ruff FAST`
- Remember that ordinary utility functions are called exactly as written.
  FastAPI only manages `def` versus `async def` behavior for callables it
  invokes as path operations or dependencies. `enforced-by: python/ruff FAST`
- Do not make CPU-bound model loading, quantization, image processing, or batch inference
  asynchronous by only adding `async def`. Use a worker, process pool, task
  queue, or other explicit execution boundary. `enforced-by: python/ruff FAST`

Good async path operation:

```python
@router.get("/items/{item_id}")
async def read_item(item_id: str) -> Item:
    return await item_client.fetch_item(item_id)
```

Good blocking path operation:

```python
@router.get("/items/{item_id}")
def read_item(item_id: str) -> Item:
    return item_repository.fetch_item(item_id)
```

## FastAPI Dependencies

Rules:

- Use dependencies for request-scoped concerns such as authentication,
  authorization, pagination parameters, database sessions, current user lookup,
  request metadata, and reusable request validation. `unenforced`
- A dependency is any callable FastAPI can call and inspect. `unenforced`
- Prefer function dependencies for simple reusable values or validation. `unenforced`
- Use class dependencies when the dependency returns a structured object that
  improves type checking and editor support. `unenforced`
- When using a class dependency, prefer
  `Annotated[CommonQueryParams, Depends()]` when the shortcut is clear. `unenforced`
- Use a dependency parameter when the path operation needs the returned value. `unenforced`
- Use `dependencies=[Depends(...)]` on a path operation, router, or app when the
  dependency must run but its value is not used. `unenforced`
- Put dependencies shared by a router on the `APIRouter`. `enforced-by: python/ruff FAST`
- Put dependencies that apply to every path operation on the `FastAPI` app. `unenforced`
- Keep dependency graphs understandable. Deep sub-dependency trees need a clear
  ownership reason. `unenforced`
- FastAPI caches dependency results per request by default. Use
  `use_cache=False` only when the same dependency must intentionally run more
  than once in one request. `unenforced`
- Dependencies may raise `HTTPException`. `enforced-by: python/ruff FAST`
- Do not add unused dependency parameters to path operation functions just to
  force execution. Use decorator, router, or app dependencies instead. `unenforced`
- Do not hide business workflows in dependencies. `unenforced`

Good value dependency:

```python
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    return decode_user_token(token)

@router.get("/users/me")
async def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user
```

Good execution-only dependency:

```python
async def verify_token(x_token: Annotated[str, Header()]) -> None:
    if x_token != EXPECTED_TOKEN:
        raise HTTPException(status_code=400, detail="Invalid token header")

@router.get("/items/", dependencies=[Depends(verify_token)])
async def read_items() -> list[Item]:
    return list_items()
```

Good class dependency:

```python
class CommonQueryParams:
    """Common pagination and search parameters."""

    def __init__(self, q: str | None = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit

@router.get("/items/")
async def read_items(
    params: Annotated[CommonQueryParams, Depends()],
) -> list[Item]:
    return list_items(q=params.q, skip=params.skip, limit=params.limit)
```

## FastAPI Dependencies with Yield

Rules:

- Use `yield` dependencies for request-scoped resource lifetime, such as
  database sessions, transactions, temporary files, and client sessions. `enforced-by: python/ruff FAST`
- A dependency with `yield` uses exactly one `yield`. `enforced-by: python/ruff FAST`
- Put setup before `yield`. `enforced-by: python/ruff FAST`
- Put cleanup in `finally`. `unenforced`
- The yielded value is injected into path operations and dependent dependencies. `unenforced`
- A dependency with `yield` may be `def` or `async def`. `enforced-by: python/ruff FAST`
- If a `yield` dependency catches an exception, it must re-raise the same
  exception or raise a deliberate replacement such as `HTTPException`. `enforced-by: python/ruff FAST`
- Do not swallow exceptions in `yield` dependencies. `enforced-by: python/ruff FAST`
- Prefer ordinary `with` or `async with` inside a `yield` dependency when a
  resource is already a context manager. `enforced-by: python/ruff FAST`
- Do not decorate FastAPI dependencies with `@contextlib.contextmanager` or
  `@contextlib.asynccontextmanager`; FastAPI handles that internally. `unenforced`
- Use `Depends(scope="function")` only when cleanup must happen after the path
  operation returns but before the response is sent. `unenforced`
- A request-scoped dependency cannot depend on a function-scoped dependency if
  it needs that dependency during cleanup. `unenforced`

Good:

```python
async def get_db() -> AsyncIterable[DBSession]:
    db = DBSession()
    try:
        yield db
    finally:
        db.close()
```

Good exception handling:

```python
def get_username() -> Iterable[str]:
    try:
        yield "Rick"
    except OwnerError as error:
        raise HTTPException(status_code=400, detail="Owner error") from error
```

Good context manager usage:

```python
async def get_db() -> AsyncIterable[DBSession]:
    with create_db_session() as db:
        yield db
```

## FastAPI Security

Rules:

- Use FastAPI security utilities for authentication and authorization that
  appears in OpenAPI. `unenforced`
- Use `OAuth2PasswordBearer` for bearer-token dependencies when that is the
  chosen security scheme. `enforced-by: python/ruff FAST`
- Use a relative `tokenUrl`, such as `tokenUrl="token"`. `enforced-by: python/ruff FAST`
- Use `OAuth2PasswordRequestForm` for OAuth2 password-flow login forms. `enforced-by: python/ruff FAST`
- Use `OAuth2PasswordRequestFormStrict` when `grant_type=password` must be
  enforced. `enforced-by: python/ruff FAST`
- Login endpoints for OAuth2 password flow receive username and password as form
  data, not JSON. `enforced-by: python/ruff FAST`
- Token endpoints return JSON with `access_token` and `token_type`. `unenforced`
- Bearer token responses use `token_type="bearer"`. `unenforced`
- Unauthorized bearer-token responses use HTTP 401 and include
  `WWW-Authenticate: Bearer`. `unenforced`
- Never store plaintext passwords. `enforced-by: python/ruff FAST`
- Hash passwords with a current password-hashing library and a recommended
  algorithm. `enforced-by: python/ruff FAST`
- Verify passwords through the password-hashing library. `enforced-by: python/ruff FAST`
- When authentication fails, use the same public error message for unknown user
  and wrong password. `enforced-by: python/ruff FAST`
- Reduce username enumeration risk by keeping failure timing consistent where
  practical, such as verifying against a dummy hash for unknown users. `enforced-by: security/semgrep`
- JWT tokens are signed, not encrypted. Do not put secrets or sensitive data in
  JWT payloads. `enforced-by: python/ruff FAST`
- JWT access tokens include an expiration. `enforced-by: python/ruff FAST`
- Use timezone-aware UTC datetimes when creating expirations. `unenforced`
- Use the JWT `sub` claim for a unique application-wide subject string when JWTs
  identify users or entities. `enforced-by: python/ruff FAST`
- Store signing secrets outside source code. `enforced-by: security/semgrep`
- Do not use documentation example secret keys, fake hashes, fake users, or fake
  token logic in real code. `enforced-by: security/semgrep`
- Catch token verification errors from the JWT library and convert them to a
  generic credentials error. `enforced-by: python/ruff FAST`
- Use scopes for fine-grained permissions when the API needs them. `unenforced`
- Prefer integrated security dependencies over custom header checks for real
  authentication. `unenforced`

Good security dependency:

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except InvalidTokenError as error:
        raise credentials_error from error

    subject = payload.get("sub")
    if subject is None:
        raise credentials_error
    user = get_user_by_subject(subject)
    if user is None:
        raise credentials_error
    return user
```

Good token response:

```python
class Token(BaseModel):
    """OAuth2 bearer token response."""

    access_token: str
    token_type: str

@router.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = authenticate_user(form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.username)
    return Token(access_token=access_token, token_type="bearer")
```

## FastAPI Streaming

Rules:

- Use streaming when the client needs items before the whole sequence
  is available. `enforced-by: python/ruff ASYNC`
- Use JSON Lines for streams of JSON objects. `enforced-by: python/ruff FAST`
- Annotate async streaming path operations as `AsyncIterable[T]`. `enforced-by: python/ruff ASYNC`
- Annotate sync streaming path operations as `Iterable[T]`. `enforced-by: python/ruff ASYNC`
- Use Pydantic models for streamed JSON items. `enforced-by: python/ruff FAST`
- Prefer a declared return type so FastAPI can validate, filter, serialize, and
  document streamed items. `unenforced`
- Use Server-Sent Events when clients need event names, event IDs, retry values,
  comments, or browser EventSource semantics. `unenforced`
- Use `EventSourceResponse` for SSE endpoints. `enforced-by: python/ruff FAST`
- Yield `ServerSentEvent(data=...)` for JSON-encoded SSE data. `unenforced`
- Yield `ServerSentEvent(raw_data=...)` for preformatted text, log lines, or
  sentinel values. `unenforced`
- Do not set both `data` and `raw_data` on the same SSE event. `unenforced`
- Include event IDs when clients need to resume after reconnecting. `enforced-by: python/ruff ASYNC`
- Read `Last-Event-ID` when resumable streams are required. `enforced-by: python/ruff ASYNC`
- SSE can use methods other than GET when the protocol requires it. `unenforced`
- Keep streamed item generation cancellable and resource-safe. `enforced-by: python/ruff ASYNC`

Good JSON Lines stream:

```python
@router.get("/items/stream")
async def stream_items() -> AsyncIterable[Item]:
    for item in iter_items():
        yield item
```

Good sync stream:

```python
@router.get("/items/stream-sync")
def stream_items_sync() -> Iterable[Item]:
    yield from iter_items()
```

Good SSE stream:

```python
@router.get("/items/events", response_class=EventSourceResponse)
async def stream_item_events() -> AsyncIterable[ServerSentEvent]:
    yield ServerSentEvent(comment="item updates")
    for index, item in enumerate(iter_items()):
        yield ServerSentEvent(data=item, event="item_update", id=str(index))
```

Good raw SSE data:

```python
@router.get("/logs/stream", response_class=EventSourceResponse)
async def stream_logs() -> AsyncIterable[ServerSentEvent]:
    for line in iter_log_lines():
        yield ServerSentEvent(raw_data=line)
```

## FastAPI Background Tasks

Rules:

- Use `BackgroundTasks` for small follow-up work that can run after the response
  is sent and stays in the same process. `enforced-by: python/ruff FAST`
- Typical uses include recording a warmup marker, writing a small audit event,
  or doing short local cleanup. `unenforced`
- Do not use `BackgroundTasks` for heavy computation, durable jobs, distributed
  work, long-running tasks, or work that must survive process restarts. `enforced-by: python/ruff FAST`
- Use a real job queue or worker system for heavy or durable background work. `enforced-by: structure/no-blocking-io-in-async`
- Import `BackgroundTasks` from `fastapi`. `enforced-by: python/ruff FAST`
- Use `BackgroundTasks`, not Starlette's singular `BackgroundTask`, for
  dependency-injected path operation parameters. `enforced-by: python/ruff FAST`
- Do not put required user-visible work in a background task if the response
  depends on its success. `unenforced`
- Background task failures happen after the response. Log and monitor them at
  the worker boundary. `enforced-by: structure/no-blocking-io-in-async`

Good:

```python
@router.post("/warmup-events/{session_id}")
async def record_warmup(
    session_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    background_tasks.add_task(record_warmup_event, session_id)
    return {"message": "Warmup event queued"}
```

## FastAPI Middleware

Rules:

- Use middleware for cross-cutting HTTP request and response behavior. `enforced-by: python/ruff FAST`
- Middleware receives the request and a `call_next` function. `enforced-by: python/ruff FAST`
- Code before `await call_next(request)` runs before the path operation. `unenforced`
- Code after `await call_next(request)` runs after the path operation and before
  returning the response. `unenforced`
- Use `time.perf_counter()` for elapsed-time measurements. `enforced-by: python/ruff FAST`
- Add custom response headers deliberately. `unenforced`
- If browser clients must read a custom header, expose it in CORS settings. `enforced-by: python/ruff FAST`
- Middleware order matters. The last middleware added is the outermost. `enforced-by: python/ruff FAST`
- On the request path, the outermost middleware runs first. `enforced-by: python/ruff FAST`
- On the response path, the outermost middleware runs last. `enforced-by: python/ruff FAST`
- Dependencies with `yield` run their exit code after middleware. `enforced-by: python/ruff FAST`
- Background tasks run after middleware. `enforced-by: python/ruff FAST`
- Keep middleware small. Do not put business logic in middleware. `enforced-by: python/ruff FAST`
- Do not use middleware when a router dependency or path operation dependency is
  the narrower correct boundary. `enforced-by: python/ruff FAST`

Good:

```python
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

## FastAPI Metadata and Docs

Rules:

- Disable OpenAPI schema output and interactive documentation by default. `unenforced`
- Expose OpenAPI, Swagger UI, or ReDoc only when the product or deployment
  explicitly requires it. `unenforced`
- Gate schema and docs exposure behind a typed configuration value loaded at
  the application boundary, such as an environment-derived `enable_api_docs`
  flag. `enforced-by: python/ruff FAST`
- Default that flag to `False`. `unenforced`
- Do not expose docs or schema only because FastAPI enables them by default. `enforced-by: security/semgrep`
- When docs are disabled, set `openapi_url=None`, `docs_url=None`, and
  `redoc_url=None`. `unenforced`
- When docs are enabled, enable all schema and docs URLs deliberately and keep
  the exposed paths stable. `unenforced`
- Do not expose internal-only endpoints, hidden admin routes, security schemes,
  example payloads, or environment-specific metadata in a public OpenAPI schema. `enforced-by: security/semgrep`
- Do not rely on obscurity of docs URLs as the control. The schema endpoint is
  the contract exposure that must be explicitly enabled or disabled. `unenforced`
- Configure API metadata on the `FastAPI` object when the API is user-facing or
  published. `unenforced`
- Metadata may include title, summary, description, version, terms of service,
  contact, and license information. `unenforced`
- Keep the metadata accurate. Do not describe endpoints or features that do not
  exist. `unenforced`
- Use tag metadata to group path operations in generated docs. `enforced-by: python/ruff FAST`
- The order of tag metadata controls docs display order. `enforced-by: python/ruff FAST`
- Use `openapi_url`, `docs_url`, and `redoc_url` deliberately when versioning,
  relocating, exposing, or disabling documentation surfaces. `enforced-by: python/ruff FAST`
- Prefer configuring the FastAPI entrypoint in project configuration when the
  tool supports it. `unenforced`

Good:

```python
tags_metadata = [
    {
        "name": "sessions",
        "description": "Operations with inventory items.",
    },
    {
        "name": "warmup",
        "description": "Operations with model warmup.",
    },
]

app = FastAPI(
    title="Inventory API",
    summary="Inventory service API.",
    version="1.0.0",
    openapi_tags=tags_metadata,
    openapi_url="/openapi.json" if config.enable_api_docs else None,
    docs_url="/docs" if config.enable_api_docs else None,
    redoc_url="/redoc" if config.enable_api_docs else None,
)
```

Good project configuration:

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

## FastAPI Testing

Follow the repository testing rules. Do not add or run tests unless requested. `enforced-by: python/ruff PT`

Rules:

- Test the HTTP contract, not FastAPI internals. `enforced-by: python/ruff PT`
- Use the framework test client or async HTTP client appropriate for the app. `enforced-by: python/ruff PT`
- Assert status codes, response bodies, headers, and auth behavior. `enforced-by: python/ruff FAST`
- Override dependencies at the app boundary for external systems. `unenforced`
- Test router-level, decorator-level, and app-level dependencies where they
  control security or request validation. `enforced-by: python/ruff PT`
- Test streaming endpoints by consuming enough items to prove the stream
  contract. `enforced-by: python/ruff PT`
- Test background tasks only when their observable side effect matters. `enforced-by: python/ruff PT`
- Do not test that FastAPI itself routes requests correctly. `enforced-by: python/ruff PT`
