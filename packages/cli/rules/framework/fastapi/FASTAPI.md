---
layer: framework
configuration: fastapi
title: FastAPI
---

# FastAPI

These rules apply when a Python project uses FastAPI for an HTTP API, web
service, internal service, webhook receiver, streaming endpoint, or API gateway.
They do not apply to non-FastAPI Python modules except where the general Python
rules already say the same thing.

The FastAPI rules span two files: this one (structure, routers, parameters, schemas, responses,
errors) and Runtime (forms and files, encoding, async, dependencies, security, streaming, background
tasks, middleware, docs, tests).

## FastAPI source decisions

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

## FastAPI application structure

Rules:

- Split nontrivial FastAPI apps across multiple modules.
- Use one main application module to create the `FastAPI` object and include
  routers.
- Put related path operations in router modules.
- Put shared dependencies in a dependencies module or a domain-owned dependency
  module.
- Put internal-only routers or admin routers in clearly named internal packages.
- Every importable package and subpackage has an `__init__.py`.
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

## FastAPI routers

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

Good router imports:

```python
from .routers import items, users

app.include_router(items.router)
app.include_router(users.router)
```

## FastAPI path operations

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

## FastAPI parameters and validation

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
- Declare fixed routes before parameterized routes that otherwise match the same path.
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

## FastAPI request and response schemas

Rules:

- Use Pydantic `BaseModel` classes for JSON request bodies and response bodies.
- Use Pydantic models as boundary schemas. Keep business workflows and
  persistence behavior outside schema classes.
- Declare required body fields without defaults.
- Declare optional or nullable body fields with explicit defaults and `None`
  annotations where applicable.
- Prefer `Field(default_factory=...)` for mutable defaults, even when Pydantic copies mutable defaults.
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

## FastAPI schema fields and examples

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

## FastAPI nested and special types

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

## FastAPI headers and cookies

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

## FastAPI response models

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
  returned object intentionally differs from the response schema and adapting it first adds noise without improving safety.
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
  are omitted from responses.
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

## FastAPI status codes and errors

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
