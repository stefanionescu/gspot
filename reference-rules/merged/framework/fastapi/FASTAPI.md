# FastAPI

## FastAPI

These rules apply when a Python project uses FastAPI for an HTTP API, web
service, internal service, webhook receiver, streaming endpoint, or API gateway.
They do not apply to non-FastAPI Python modules except where the general Python
rules already say the same thing.

### FastAPI Source Decisions

Rules:

- Keep FastAPI framework code organized by application boundaries: app creation,
  routers, dependencies, schemas, security, middleware, and infrastructure.
- Prefer `Annotated[..., Query(...)]`, `Annotated[..., Path(...)]`,
  `Annotated[..., Body(...)]`, `Annotated[..., Depends(...)]`,
  `Annotated[..., Header()]`, `Annotated[..., Cookie()]`, and similar metadata
  annotations for FastAPI parameters.
- Use Pydantic models for request bodies, response bodies, and documented
  structured data.
- Return concrete Pydantic models, dataclasses, dictionaries, lists, or
  iterables that match the declared return type.
- Use FastAPI and Starlette primitives directly when they own the HTTP behavior.
- Keep business logic outside path operation functions. Path operations adapt
  HTTP input to application calls and adapt application results to HTTP output.
- Keep database, SDK, and service clients out of module-level import-time work.
- Keep security-specific rules stricter than general examples. Documentation
  examples with fake secrets, fake hashes, fake users, or fake tokens are not
  acceptable production patterns.
- Do not add a FastAPI dependency, middleware, background task, or router when a
  plain Python function is enough.

### FastAPI Application Structure

Rules:

- Split nontrivial FastAPI apps across multiple modules.
- Use one main application module to create the `FastAPI` object and include
  routers.
- Put related path operations in router modules.
- Put shared dependencies in a dependencies module or a domain-owned dependency
  module.
- Put internal-only routers or admin routers in clearly named internal packages.
- Every package and subpackage that should be importable has an `__init__.py`.
- Keep the main app module small. It wires routers, global dependencies,
  middleware, exception handlers, metadata, and startup configuration.
- Configure the FastAPI entrypoint in project configuration when the deployment
  tool supports it.
- Do not depend on running the app from the repository root.
- Do not patch `sys.path` to make a FastAPI app importable from source.

Good shape:

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

Good main module:

```python
from fastapi import Depends, FastAPI

from .dependencies import get_query_token, get_token_header
from .internal import admin
from .routers import items, users

app = FastAPI(dependencies=[Depends(get_query_token)])

app.include_router(users.router)
app.include_router(items.router)
app.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_token_header)],
)
```

Bad main module:

```python
app = FastAPI()

@app.get("/users/")
async def read_users():
    ...

@app.get("/items/")
async def read_items():
    ...

@app.get("/admin/")
async def read_admin():
    ...
```

### FastAPI Routers

Rules:

- Use `APIRouter` to group related path operations.
- Name the router object `router` unless a local framework convention requires
  a more specific name.
- Import router modules when multiple modules expose a `router` object, so names
  do not collide.
- Put shared router prefix, tags, dependencies, and default responses on the
  `APIRouter`.
- Router prefixes do not end with `/`.
- Path operation paths start with `/`.
- Add path-operation-specific tags, dependencies, status codes, and responses
  only when they differ from the router default.
- Include routers in the main app module or a higher-level router module.
- Include a router in another router before including the parent router in the
  app.
- Reusing the same router under multiple prefixes is an advanced pattern. Use it
  only when the same API must intentionally be exposed under multiple route
  groups.

Good router module:

```python
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_token_header

router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(get_token_header)],
    responses={404: {"description": "Not found"}},
)

@router.get("/")
async def read_items() -> list[Item]:
    return list_items()
```

Bad router prefix:

```python
router = APIRouter(prefix="/items/")

@router.get("latest")
async def read_latest():
    ...
```

Good router imports:

```python
from .routers import items, users

app.include_router(items.router)
app.include_router(users.router)
```

Bad router imports:

```python
from .routers.items import router
from .routers.users import router
```

### FastAPI Path Operations

Rules:

- Keep path operation functions thin.
- Annotate path operation parameters and return values.
- Use response models or return type annotations so FastAPI can validate,
  filter, document, and serialize responses.
- Use `HTTPException` for HTTP errors that are part of the API contract.
- Use precise status codes.
- Do not leak internal error details in `HTTPException.detail`.
- Use `status` constants when they make intent clearer.
- Use `Annotated` for headers, cookies, dependencies, form fields, and other
  parameter metadata.
- Do not use path operation functions as dumping grounds for database access,
  authorization logic, external API calls, and response formatting.
- Put repeated path operation policy at the router or app level.
- Use relative OpenAPI security URLs such as `tokenUrl="token"` so deployments
  behind a proxy can keep working.

Good:

```python
@router.get("/{item_id}")
async def read_item(item_id: str) -> Item:
    item = get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
```

Bad:

```python
@router.get("/{item_id}")
async def read_item(item_id):
    row = db.execute(f"select * from items where id = {item_id}")
    if not row:
        raise Exception("missing item in item table")
    return row
```

### FastAPI Parameters and Validation

Rules:

- Use standard Python type annotations on path operation parameters so FastAPI
  can parse, validate, document, and serialize consistently.
- Treat a missing default value as required.
- Treat a default value, including `None`, as optional.
- When a parameter can be `None`, include `None` in the type annotation.
- Use `Query`, `Path`, `Body`, `Header`, `Cookie`, and `Form` inside
  `Annotated` for framework metadata and validation.
- Keep `Annotated` defaults in the function signature, not inside `Query`,
  `Path`, `Body`, or other metadata objects.
- Use `min_length`, `max_length`, and `pattern` for string constraints at the
  HTTP boundary when those constraints are part of the API contract.
- Use `gt`, `ge`, `lt`, and `le` for numeric constraints at the HTTP boundary.
- Use Pydantic validators for pure request-value validation that only depends
  on the request data.
- Use dependencies, not validators, for validation that needs a database,
  service call, filesystem access, authorization state, or other external I/O.
- Declare fixed routes before parameterized routes that could otherwise match
  the same path.
- Do not define two path operations for the same method and path.
- Use `str, Enum` path parameter types for documented string choices.
- Use the `{name:path}` path convertor only when a path parameter is genuinely
  allowed to contain slashes.
- Use aliases only to preserve external API names that are not valid or desired
  Python identifiers. Translate to domain names before moving inward.
- For query parameters that can appear multiple times, use an explicit
  `Query()` annotation with a collection type such as `list[str]`.
- Use Pydantic query parameter models for cohesive groups such as pagination,
  filtering, sorting, or search options.
- Set `model_config = {"extra": "forbid"}` on a query parameter model when
  unknown query parameters are invalid for that endpoint.

Good validated parameters:

```python
@router.get("/items/{item_id}")
async def read_item(
    item_id: Annotated[int, Path(ge=1)],
    q: Annotated[str | None, Query(max_length=50)] = None,
) -> Item:
    return get_item(item_id=item_id, query=q)
```

Good query parameter model:

```python
class FilterParams(BaseModel):
    """Query parameters for item filtering."""

    model_config = {"extra": "forbid"}

    limit: int = Field(100, gt=0, le=100)
    offset: int = Field(0, ge=0)
    order_by: Literal["created_at", "updated_at"] = "created_at"
    tags: list[str] = Field(default_factory=list)

@router.get("/items/")
async def read_items(filters: Annotated[FilterParams, Query()]) -> list[Item]:
    return list_items(filters=filters)
```

Good route order:

```python
@router.get("/users/me")
async def read_current_user() -> User:
    return get_current_user()

@router.get("/users/{user_id}")
async def read_user(user_id: str) -> User:
    return get_user(user_id)
```

Bad route order:

```python
@router.get("/users/{user_id}")
async def read_user(user_id: str) -> User:
    return get_user(user_id)

@router.get("/users/me")
async def read_current_user() -> User:
    return get_current_user()
```

Bad old-style metadata default:

```python
@router.get("/items/")
async def read_items(q: str | None = Query(default=None, max_length=50)) -> list[Item]:
    return list_items(query=q)
```

### FastAPI Request and Response Schemas

Rules:

- Use Pydantic `BaseModel` classes for JSON request bodies and response bodies.
- Use Pydantic models as boundary schemas. Keep business workflows and
  persistence behavior outside schema classes.
- Declare required body fields without defaults.
- Declare optional or nullable body fields with explicit defaults and `None`
  annotations where applicable.
- Prefer `Field(default_factory=...)` for mutable defaults, even when Pydantic
  would copy mutable defaults.
- Use `Field` constraints on model attributes when the constraint belongs to the
  schema contract.
- Use separate schema classes for create, read, and update shapes when their
  required fields, nullable fields, or public fields differ.
- Do not send request bodies with `GET` endpoints.
- Use `Body()` for singular values that must come from the request body instead
  of the query string.
- Use `Body(embed=True)` only when the wire contract intentionally wraps a
  single body model under its parameter name.
- When multiple body parameters are declared, document and preserve the keyed
  body shape clients must send.
- Use `.model_dump()` for Pydantic v2 model-to-dict conversion.
- Use `.model_dump(exclude_unset=True)` for partial-update input where omitted
  values must not overwrite stored values.
- Use `.model_copy(update=...)` to create updated model values without mutating
  the original model.
- Use `jsonable_encoder()` when converting Pydantic models or datetimes to
  values that must be JSON-compatible for storage or transport.
- Use `response_model` or a return type annotation when response filtering,
  validation, serialization, or documentation matters.

Good schema defaults:

```python
class ItemCreate(BaseModel):
    """Request body for creating an item."""

    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
```

Good body embedding when the API contract requires an envelope:

```python
@router.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: Annotated[ItemCreate, Body(embed=True)],
) -> Item:
    return save_item(item_id=item_id, item=item)
```

Good partial update:

```python
@router.patch("/items/{item_id}")
async def patch_item(item_id: str, item: ItemUpdate) -> Item:
    stored_item = get_item(item_id)
    update_data = item.model_dump(exclude_unset=True)
    return stored_item.model_copy(update=update_data)
```

Bad mutable schema default:

```python
class ItemCreate(BaseModel):
    tags: list[str] = []
```

Bad GET body:

```python
@router.get("/items/search")
async def search_items(filters: FilterParams) -> list[Item]:
    return list_items(filters=filters)
```

### FastAPI Schema Fields and Examples

Rules:

- Import `Field` from `pydantic`, not from `fastapi`.
- Use `Field` for Pydantic model attribute validation, defaults, and schema
  metadata.
- Use `Query`, `Path`, `Body`, `Header`, `Cookie`, `Form`, and `File` for
  FastAPI parameter metadata.
- Keep model field defaults in `Field(default=...)` or ordinary assignment
  syntax, consistently with surrounding schema code.
- Use `Field(default_factory=...)` for mutable field defaults.
- Use `Field` constraints when the constraint belongs to the JSON schema, not
  only to one handler implementation.
- Use `title`, `description`, `deprecated`, `examples`, and validation
  arguments deliberately. They become part of generated JSON Schema and
  OpenAPI.
- Do not add arbitrary extra keyword arguments to `Field`, `Query`, `Body`, or
  similar helpers unless the generated schema extension is intentional and
  compatible with the OpenAPI tools that consume it.
- Put whole-model request examples in `model_config["json_schema_extra"]`.
- Put field-level examples in `Field(examples=[...])`.
- Put body or parameter examples in the relevant FastAPI helper, such as
  `Body(examples=[...])`.
- Prefer the JSON Schema `examples` field over older singular `example`
  metadata.
- Use `openapi_examples` only when the API docs need named examples with
  summaries, descriptions, values, or external example URLs.
- Keep examples sanitized. Do not include real secrets, tokens, credentials,
  internal IDs, production hostnames, personal data, or customer data.
- Make examples valid by default. Include invalid examples only when the docs
  intentionally demonstrate validation failure.
- Keep examples aligned with current schema fields. Remove examples when they
  become stale.

Good model field metadata:

```python
class PromptRequest(BaseModel):
    """Request body for a prompt."""

    prompt: str = Field(examples=["Warm up the selected model."])
    session_id: str | None = Field(default=None, max_length=128)
    max_tokens: int = Field(gt=0, le=4096)
    stop: list[str] = Field(default_factory=list)
```

Good model example:

```python
class PromptRequest(BaseModel):
    """Request body for a prompt."""

    prompt: str
    max_tokens: int

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prompt": "Warm up the selected model.",
                    "max_tokens": 128,
                }
            ],
        },
    }
```

Good OpenAPI examples:

```python
@router.put("/prompts/{session_id}")
async def update_prompt(
    session_id: str,
    prompt: Annotated[
        PromptRequest,
        Body(
            openapi_examples={
                "normal": {
                    "summary": "Valid prompt",
                    "value": {"prompt": "Warm up the selected model.", "max_tokens": 128},
                },
            },
        ),
    ],
) -> PromptRequest:
    return save_prompt(session_id=session_id, prompt=prompt)
```

Bad `Field` import:

```python
from fastapi import Field
```

Bad schema metadata:

```python
class ItemCreate(BaseModel):
    name: str = Field(ui_widget="secret-internal-control")
    api_key: str = Field(examples=["sk-live-real-token"])
    tags: list[str] = []
```

### FastAPI Nested and Special Types

Rules:

- Use nested Pydantic models for structured JSON objects with known fields.
- Do not model known JSON object shapes as `dict[str, object]`.
- Specify type parameters for `list`, `set`, `frozenset`, `tuple`, and `dict`
  fields.
- Use `list[Model]` for arrays of structured objects.
- Use top-level `list[Model]` body parameters only when the external API
  contract is a JSON array.
- Use `set[T]` or `frozenset[T]` when uniqueness is part of the domain
  contract. Remember that JSON responses still serialize these values as
  arrays.
- Use `dict[KeyType, ValueType]` bodies only when valid field names are not
  known ahead of time.
- Remember that JSON object keys are strings. If a body is typed as
  `dict[int, float]`, clients still send string keys and Pydantic validates and
  converts them.
- Use precise Pydantic and standard-library types at API boundaries when they
  express the domain better than plain strings.
- Use `UUID` for UUID identifiers.
- Use timezone-aware `datetime` values for instants that cross process or
  service boundaries.
- Use `date`, `time`, and `timedelta` when those are the actual domain values.
- Use `Decimal` for exact decimal quantities such as money or prices when
  binary floating-point behavior is not acceptable.
- Use Pydantic string-like types such as `HttpUrl` and `EmailStr` when URL or
  email validation is part of the schema contract.
- Use `bytes` only for small binary values represented in JSON. Use FastAPI
  file handling for uploaded files.
- Avoid deeply nested request bodies when the domain can be expressed as
  smaller endpoints or named resources.

Good nested schema:

```python
class Image(BaseModel):
    """Image metadata."""

    url: HttpUrl
    name: str

class ItemCreate(BaseModel):
    """Request body for creating an item."""

    name: str
    tags: set[str] = Field(default_factory=set)
    images: list[Image] = Field(default_factory=list)
```

Good arbitrary-key body:

```python
@router.post("/index-weights/")
async def create_index_weights(weights: dict[int, float]) -> dict[int, float]:
    return weights
```

Bad untyped collection fields:

```python
class ItemCreate(BaseModel):
    tags: list = []
    image: dict[str, object]
```

### FastAPI Headers and Cookies

Rules:

- Use `Header()` for values that must come from HTTP headers.
- Use `Cookie()` for values that must come from cookies.
- Do not rely on plain scalar parameters for headers or cookies. FastAPI treats
  plain non-path scalar parameters as query parameters.
- Use `Annotated[..., Header()]` and `Annotated[..., Cookie()]` for new code.
- Keep Python parameter and field names in snake_case.
- Let `Header()` convert underscores to hyphens by default.
- Set `Header(convert_underscores=False)` only when an external protocol
  requires underscores in header names and the deployment path supports them.
- Remember that HTTP header names are case-insensitive.
- Use `list[str] | None` with `Header()` for duplicate headers that can appear
  more than once.
- Use Pydantic header parameter models for cohesive groups of related headers.
- Use Pydantic cookie parameter models for cohesive groups of related cookies.
- Use `model_config = {"extra": "forbid"}` on header or cookie models when
  unknown headers or cookies are invalid for that endpoint.
- Prefer `Field(default_factory=list)` for repeated header fields in models.
- Do not log cookies, authorization headers, session IDs, CSRF tokens, or other
  sensitive header values.
- Do not use ad hoc header parameters for authentication when FastAPI security
  utilities can express the authentication scheme.
- Do not rely on Swagger UI execution to prove cookie behavior. Browser cookie
  handling can prevent JavaScript-driven docs requests from sending the cookie
  value entered in the UI.

Good header parameter:

```python
@router.get("/items/")
async def read_items(user_agent: Annotated[str | None, Header()] = None) -> list[Item]:
    return list_items(user_agent=user_agent)
```

Good duplicate header:

```python
@router.get("/items/")
async def read_items(x_token: Annotated[list[str] | None, Header()] = None) -> list[Item]:
    return list_items(tokens=x_token or [])
```

Good header model:

```python
class CommonHeaders(BaseModel):
    """Headers shared by item endpoints."""

    model_config = {"extra": "forbid"}

    host: str
    save_data: bool
    if_modified_since: str | None = None
    x_tag: list[str] = Field(default_factory=list)

@router.get("/items/")
async def read_items(headers: Annotated[CommonHeaders, Header()]) -> list[Item]:
    return list_items(headers=headers)
```

Good cookie model:

```python
class SessionCookies(BaseModel):
    """Cookies required for session-aware endpoints."""

    model_config = {"extra": "forbid"}

    session_id: str

@router.get("/items/")
async def read_items(cookies: Annotated[SessionCookies, Cookie()]) -> list[Item]:
    return list_items(session_id=cookies.session_id)
```

Bad header or cookie source:

```python
@router.get("/items/")
async def read_items(user_agent: str | None = None, session_id: str | None = None):
    return list_items(user_agent=user_agent, session_id=session_id)
```

Bad underscore header override:

```python
@router.get("/items/")
async def read_items(x_custom_header: Annotated[str, Header(convert_underscores=False)]):
    return list_items(header=x_custom_header)
```

### FastAPI Response Models

Rules:

- Prefer return type annotations when the function returns the same public
  schema shape it declares.
- Use the path operation decorator's `response_model` when the returned Python
  object differs from the public response schema.
- Remember that `response_model` takes priority over the return type annotation
  for FastAPI validation, serialization, documentation, and filtering.
- Prefer returning an instance of the public response model when that is simple
  and keeps type checking precise.
- Use `-> Any` with `response_model=...` only at a FastAPI boundary where the
  returned object intentionally differs from the response schema and adapting it
  first would add noise without improving safety.
- Never reuse an input schema containing passwords, tokens, secrets, or private
  fields as the response schema.
- Use separate input and output models when request and response fields differ.
- Schema inheritance is acceptable for response filtering only when the subclass
  is a true specialization of the public base schema.
- Use direct `Response` or `Response` subclass return annotations when returning
  a Starlette/FastAPI response object directly.
- Do not annotate a path operation with a return type that FastAPI cannot turn
  into a Pydantic response model unless the path operation sets
  `response_model=None`.
- Use `response_model=None` only when response model generation is deliberately
  disabled and the route's response contract is documented another way.
- Use `response_model_exclude_unset=True` when omitted default-valued fields
  should be omitted from responses.
- Use `response_model_exclude_defaults=True` or
  `response_model_exclude_none=True` only when that omission is part of the
  public response contract.
- Prefer dedicated output models over `response_model_include` and
  `response_model_exclude`.
- Do not rely on `response_model_include` or `response_model_exclude` for
  security filtering. The generated OpenAPI schema still describes the full
  response model.
- Treat response validation failures as server bugs. Fix the returned data or
  response schema rather than weakening validation.

Good return type:

```python
@router.get("/items/{item_id}")
async def read_item(item_id: str) -> ItemOut:
    return get_item_out(item_id)
```

Good response model for a different internal return shape:

```python
@router.post("/users/", response_model=UserOut)
async def create_user(user: UserIn) -> Any:
    return save_user(user)
```

Good direct response:

```python
@router.get("/download")
async def download_report() -> Response:
    return FileResponse(path=REPORT_PATH)
```

Good explicit response-model disable:

```python
@router.get("/portal", response_model=None)
async def get_portal(teleport: bool = False) -> Response | dict[str, str]:
    if teleport:
        return RedirectResponse(url="/elsewhere")
    return {"message": "Portal ready"}
```

Bad secret leakage:

```python
class UserIn(BaseModel):
    username: str
    password: str

@router.post("/users/")
async def create_user(user: UserIn) -> UserIn:
    return user
```

Bad response filtering shortcut:

```python
@router.get("/users/{user_id}", response_model=User, response_model_exclude={"password_hash"})
async def read_user(user_id: str):
    return get_user(user_id)
```

### FastAPI Status Codes and Errors

Rules:

- Declare successful non-default HTTP status codes with the path operation
  decorator's `status_code` parameter.
- Do not model status codes as path operation function parameters.
- Prefer `fastapi.status` constants for readability, such as
  `status.HTTP_201_CREATED`.
- Python's `http.HTTPStatus` is acceptable when surrounding code already uses
  it.
- Use the default 200 only when it is the correct success response.
- Use 201 for successful resource creation.
- Use 202 only when the request was accepted but the work is not complete.
- Use 204 only when the response intentionally has no body.
- Do not return a body with status codes that must not have one, including 204
  and 304.
- Do not manually return 500-range status codes for ordinary application
  failures. Raise or let unexpected exceptions surface at the server boundary.
- Use `HTTPException` for HTTP errors that are part of the API contract.
- Raise `HTTPException`; do not return it.
- Keep `HTTPException.detail` sanitized and user-facing.
- Do not include stack traces, file paths, table names, internal IDs, request
  bodies, secrets, or implementation details in error responses.
- Use custom `HTTPException` headers only for public protocol requirements,
  such as authentication challenges, rate limits, or documented client
  behavior.
- Put global exception handlers in the FastAPI application setup boundary.
- Register HTTP exception handlers for Starlette's `HTTPException` when the
  handler must catch FastAPI, Starlette, and extension-raised HTTP errors.
- Custom exception handlers must return the API's standard error shape and
  status code policy.
- Do not expose `RequestValidationError.body` to clients.
- Do not stringify validation exceptions into client responses. Validation
  errors can include internal context that is safe for logs only after review.
- Reuse FastAPI's default exception handlers when adding logging or metrics
  around the default behavior.
- Log validation and HTTP errors carefully. Do not log full authenticated
  request bodies or sensitive headers.

Good created status:

```python
@router.post("/items/", status_code=status.HTTP_201_CREATED)
async def create_item(item: ItemCreate) -> ItemOut:
    return save_item(item)
```

Good no-content status:

```python
@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str) -> None:
    delete_existing_item(item_id)
```

Good API error:

```python
@router.get("/items/{item_id}")
async def read_item(item_id: str) -> ItemOut:
    item = find_item(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item
```

Good exception handler boundary:

```python
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": "Request failed"},
    )
```

Bad status code parameter:

```python
@router.post("/items/")
async def create_item(item: ItemCreate, status_code: int = 201) -> ItemOut:
    return save_item(item)
```

Bad no-content body:

```python
@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str) -> dict[str, str]:
    delete_existing_item(item_id)
    return {"status": "deleted"}
```

Bad leaked validation response:

```python
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )
```

### FastAPI Forms and Files

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

Bad form source:

```python
@router.post("/login/")
async def login(username: str, password: str) -> Token:
    return authenticate_form_user(username=username, password=password)
```

Bad upload for unbounded files:

```python
@router.post("/videos/")
async def upload_video(video: Annotated[bytes, File()]) -> VideoUploadResult:
    return store_video(video)
```

Bad mixed body encoding:

```python
@router.post("/items/import")
async def import_items(file: UploadFile, metadata: ItemImportMetadata) -> ImportResult:
    return import_file(file=file, metadata=metadata)
```

### FastAPI JSON Encoding and Updates

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
- Partial-update schemas should make every patchable field optional.
- For partial updates, use `.model_dump(exclude_unset=True)` to distinguish
  omitted fields from fields explicitly set to defaults or `None`.
- Use `.model_copy(update=...)` to produce an updated Pydantic model without
  mutating the stored model instance.
- Convert the updated model with `jsonable_encoder()` before saving it to a
  JSON-only store.
- Do not apply `model_dump()` without `exclude_unset=True` for partial updates.
  That can overwrite stored values with model defaults.
- Do not use one schema for create, replace, patch, and read operations when
  those operations have different required fields or visibility rules.

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

Bad partial update:

```python
@router.patch("/items/{item_id}")
async def patch_item(item_id: str, item: ItemPatch) -> ItemOut:
    stored_item = ItemOut.model_validate(item_store[item_id])
    updated_item = stored_item.model_copy(update=item.model_dump())
    item_store[item_id] = jsonable_encoder(updated_item)
    return updated_item
```

### FastAPI Async and Blocking Work

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
- Mix `def` and `async def` path operations and dependencies as needed.
- Remember that ordinary utility functions are called exactly as written.
  FastAPI only manages `def` versus `async def` behavior for callables it
  invokes as path operations or dependencies.
- Do not make CPU-bound model loading, quantization, image processing, or batch inference
  asynchronous by only adding `async def`. Use a worker, process pool, task
  queue, or other explicit execution boundary.

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

Bad blocking call inside async path operation:

```python
@router.get("/items/{item_id}")
async def read_item(item_id: str) -> Item:
    return item_repository.fetch_item(item_id)
```

### FastAPI Dependencies

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

Bad unused dependency parameter:

```python
@router.get("/items/")
async def read_items(_: Annotated[None, Depends(verify_token)]) -> list[Item]:
    return list_items()
```

### FastAPI Dependencies with Yield

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

Bad swallowed exception:

```python
def get_username() -> Iterable[str]:
    try:
        yield "Rick"
    except OwnerError:
        logger.error("Owner error")
```

Good context manager usage:

```python
async def get_db() -> AsyncIterable[DBSession]:
    with create_db_session() as db:
        yield db
```

### FastAPI Security

Rules:

- Use FastAPI security utilities for authentication and authorization that
  should appear in OpenAPI.
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
- Use the JWT `sub` claim for a unique application-wide subject string when JWTs
  identify users or entities.
- Store signing secrets outside source code.
- Do not use documentation example secret keys, fake hashes, fake users, or fake
  token logic in real code.
- Catch token verification errors from the JWT library and convert them to a
  generic credentials error.
- Use scopes for fine-grained permissions when the API needs them.
- Prefer integrated security dependencies over custom header checks for real
  authentication.

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

Bad security:

```python
SECRET_KEY = "example-secret"

def fake_decode_token(token: str) -> User:
    return get_user(token)
```

### FastAPI Streaming

Rules:

- Use streaming when the client should receive items before the whole sequence
  is available.
- Use JSON Lines for streams of JSON objects.
- Annotate async streaming path operations as `AsyncIterable[T]`.
- Annotate sync streaming path operations as `Iterable[T]`.
- Use Pydantic models for streamed JSON items when possible.
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

Bad SSE event:

```python
yield ServerSentEvent(data=item, raw_data="[DONE]")
```

### FastAPI Background Tasks

Rules:

- Use `BackgroundTasks` for small follow-up work that can run after the response
  is sent and should stay in the same process.
- Typical uses include recording a warmup marker, writing a small audit event,
  or doing short local cleanup.
- Do not use `BackgroundTasks` for heavy computation, durable jobs, distributed
  work, long-running tasks, or work that must survive process restarts.
- Use a real job queue or worker system for heavy or durable background work.
- Import `BackgroundTasks` from `fastapi`.
- Use `BackgroundTasks`, not Starlette's singular `BackgroundTask`, for
  dependency-injected path operation parameters.
- Do not put required user-visible work in a background task if the response
  should depend on its success.
- Background task failures happen after the response. Log and monitor them at
  the worker boundary.

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

Bad:

```python
@router.post("/warmup")
async def warmup_model(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_full_warmup)
    return {"message": "Warmup started"}
```

### FastAPI Middleware

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
- Dependencies with `yield` run their exit code after middleware.
- Background tasks run after middleware.
- Keep middleware small. Do not put business logic in middleware.
- Do not use middleware when a router dependency or path operation dependency is
  the narrower correct boundary.

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

Bad:

```python
@app.middleware("http")
async def authorize_and_run_business_logic(request: Request, call_next):
    update_user_records(request)
    return await call_next(request)
```

### FastAPI Metadata and Docs

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

Bad default exposure:

```python
app = FastAPI(title="Inventory API")
```

Good project configuration:

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

### FastAPI Testing

Follow the repository testing rules. Do not add or run tests unless requested.

Rules when FastAPI tests are requested:

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

### FastAPI Anti-Patterns

Do not write:

```python
app = FastAPI()

@app.get("/users/")
async def read_users():
    ...

@app.get("/items/")
async def read_items():
    ...
```

```python
router = APIRouter(prefix="/items/")
```

```python
@router.get("latest")
async def read_latest():
    ...
```

```python
@router.get("/items/")
async def read_items(unused: Annotated[None, Depends(verify_token)]):
    ...
```

```python
@router.get("/items/")
async def read_items(q: str | None = Query(default=None, max_length=50)):
    ...
```

```python
@router.get("/users/{user_id}")
async def read_user(user_id: str):
    ...

@router.get("/users/me")
async def read_current_user():
    ...
```

```python
@router.get("/items/search")
async def search_items(filters: FilterParams):
    ...
```

```python
@router.get("/items/{item_id}")
async def read_item(item_id: str):
    return blocking_repository.fetch_item(item_id)
```

```python
from fastapi import Field
```

```python
class ItemCreate(BaseModel):
    name: str = Field(ui_widget="private-admin-control")
    tags: list[str] = []
```

```python
class ItemCreate(BaseModel):
    image: dict[str, object]
    tags: list = []
```

```python
@router.get("/items/")
async def read_items(user_agent: str | None = None, session_id: str | None = None):
    ...
```

```python
@router.get("/items/")
async def read_items(x_custom_header: Annotated[str, Header(convert_underscores=False)]):
    ...
```

```python
class UserIn(BaseModel):
    username: str
    password: str

@router.post("/users/")
async def create_user(user: UserIn) -> UserIn:
    return user
```

```python
@router.get("/users/{user_id}", response_model=User, response_model_exclude={"password_hash"})
async def read_user(user_id: str):
    return get_user(user_id)
```

```python
@router.post("/items/")
async def create_item(item: ItemCreate, status_code: int = 201):
    ...
```

```python
@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str):
    return {"status": "deleted"}
```

```python
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(content={"detail": exc.errors(), "body": exc.body})
```

```python
@router.post("/login/")
async def login(username: str, password: str):
    ...
```

```python
@router.post("/videos/")
async def upload_video(video: Annotated[bytes, File()]):
    ...
```

```python
@router.post("/items/import")
async def import_items(file: UploadFile, metadata: ItemImportMetadata):
    ...
```

```python
@router.patch("/items/{item_id}")
async def patch_item(item_id: str, item: ItemPatch):
    update_data = item.model_dump()
    ...
```

```python
async def get_db():
    db = DBSession()
    yield db
    db.close()
```

```python
def get_username():
    try:
        yield "Rick"
    except OwnerError:
        logger.error("Owner error")
```

```python
SECRET_KEY = "example-secret"
```

```python
@router.post("/token")
async def login(credentials: LoginJson):
    ...
```

```python
@router.get("/logs", response_class=EventSourceResponse)
async def stream_logs():
    yield ServerSentEvent(data="line", raw_data="line")
```

```python
@app.middleware("http")
async def run_domain_work(request: Request, call_next):
    sync_customer_records()
    return await call_next(request)
```
