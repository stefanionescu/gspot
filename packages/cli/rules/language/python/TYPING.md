---
layer: language
configuration: python
title: Python Typing
---

# Python Typing

Type annotations, `Any`, generics, aliases, protocols, and type-checker suppressions. The module and
interface rules are in the Python file.

## Type annotations

Type annotations improve readability and catch type-related errors. They are
especially important for public APIs, stable code, complex data shapes, and
model or data boundaries.

### Annotation scope

Rules:

- Annotate every parameter and every return value of every function and method, including
  private helpers and `__init__` (`-> None`). The type checker runs in strict mode and reports
  an unannotated function.
- Do not annotate `self` or `cls` unless needed for precise typing.
- Use `Any` only when the type is genuinely unconstrained or cannot be
  expressed clearly.
- Do not add obsolete `# type:` comments.
- Prefer the modern shorthand syntax over older `typing.Union`,
  `typing.Optional`, `typing.List`, `typing.Dict`, and `typing.Type` aliases.

Good:

```python
def build_examples(source: Literal["warmup", "test"] = "warmup") -> list[PromptExample]:
    """Build examples for a data source."""
```

Private helpers are annotated too:

```python
def _token_count(value: int) -> int:
    return int(value)
```

### Annotated metadata

Rules:

- Use `typing.Annotated` when a framework or validation library needs metadata
  attached to a normal Python type.
- Put the real type first. Put framework or validation metadata after it.
- Keep defaults as ordinary Python parameter defaults when using
  `Annotated`.
- Do not put conflicting defaults in both the metadata object and the function
  signature.
- Do not use arbitrary string metadata as a substitute for clear domain types,
  validators, or documented framework metadata.
- Prefer `Annotated` over older framework styles that replace the Python
  default value with a metadata object.

Good:

```python
def read_items(q: Annotated[str | None, Query(max_length=50)] = None) -> list[Item]:
    return find_items(query=q)
```

### Using any and object

Rules:

- Use `object` when a value can be literally any Python object and the function
  only uses operations available on all objects, such as passing the value to
  `str()`.
- Use `object` for callback return values when the callback return value is
  ignored.
- Use `Any` when the type cannot be expressed accurately, the correct type makes the API unreasonably hard to use, or the value intentionally escapes type
  checking.
- Do not use `Any` just to avoid writing a precise type.
- Prefer a protocol, type variable, overload, or small value object over `Any`
  when that models the contract clearly.

Good:

```python
def format_for_display(value: object) -> str:
    """Format any object for display."""
    if isinstance(value, int):
        return f"{value:02}"
    return str(value)

def call_callback(callback: Callable[[int], object]) -> None:
    """Call a callback and ignore its return value."""
    callback(42)
```

### Input and return types

Rules:

- For arguments, prefer protocols and abstract collection types such as
  `Iterable`, `Sequence`, `Mapping`, and `Callable`.
- For arguments that accept any value, use `object`, not `Any`.
- For concrete implementations, return concrete types such as `list`, `dict`,
  and concrete dataclasses.
- For protocols and abstract base classes, choose return types case by case
  based on the promised interface.
- Avoid union return types when callers must immediately branch with
  `isinstance()` to use the result.
- If different result shapes require different caller behavior, prefer separate
  functions, a tagged dataclass, a protocol, or a small hierarchy with a clear
  common contract.
- Use `float` instead of `int | float` for numeric APIs where integers are valid
  float inputs.
- Use `None`, not `Literal[None]`.

Good:

```python
def map_lengths(values: Iterable[str]) -> list[int]:
    return [len(value) for value in values]

def create_label_map() -> dict[str, int]:
    return {"reject": 0, "accept": 1}

def to_display_text(value: object) -> str:
    return str(value)
```

### Typing imports

Rules:

- Import symbols from `typing` and `collections.abc` directly.
- Prefer `collections.abc` abstract containers for input types.
- Prefer built-in generic types such as `list[str]`, `dict[str, int]`, and
  `tuple[str, ...]`.
- Do not use `typing.List`, `typing.Dict`, or `typing.Tuple` in new code.
- Do not use `typing.Type`; use built-in `type`.
- Do not use `typing.Union` or `typing.Optional`; use `|`.
- Do not use `typing.Text` in new code.
- Use `str` for text and `bytes` for binary data.
- Use `AnyStr` only when multiple string annotations must all be the same text
  or binary type.

Good:

```python
from collections.abc import Iterable, Mapping, Sequence
from typing import Any, Literal, TypeAlias

def transform(rows: Sequence[tuple[str, int]]) -> Mapping[str, int]:
    ...
```

### None and optional values

Rules:

- Use explicit `X | None` for nullable values.
- Put `None` last in union annotations.
- Do not rely on implicit optional inference from a default of `None`.
- Use `is None` and `is not None` for None checks.
- When a parameter is nullable and has a default, annotate it as nullable.

Good:

```python
def read_examples(path: Path | None = None) -> list[PromptExample]:
    if path is None:
        path = DEFAULT_DATA_PATH
    ...
```

### Generic types

Rules:

- Specify type parameters for generic types.
- Do not write bare `Sequence`, `Mapping`, `list`, or `dict` unless the element
  type is intentionally unconstrained and made explicit with `Any`.
- Prefer `TypeVar` when a relationship between input and output types matters.

Good:

```python
def get_names(employee_ids: Sequence[int]) -> Mapping[int, str]:
    ...
```

Good when the key type must be preserved:

```python
_T = TypeVar("_T")

def get_names(employee_ids: Sequence[_T]) -> Mapping[_T, str]:
    ...
```

### Type aliases

Rules:

- Use type aliases for complex repeated types.
- Type alias names use CapWords.
- Internal type aliases use one leading underscore.
- Use `type` statements for new type aliases when the declared Python version supports them
  and the surrounding module already uses them.
- Keep `TypeAlias` for existing aliases when changing syntax creates unrelated churn.
- Do not use `TypeAlias` for ordinary value, module, class, function, constant,
  or path aliases.

Good:

```python
from typing import TypeAlias

_LossAndGradient: TypeAlias = tuple[torch.Tensor, torch.Tensor]
MetricMap: TypeAlias = Mapping[str, float]
Path = pathlib.Path
ERROR_EXISTS = errno.EEXIST
```

### Type variables

Rules:

- Private unconstrained type variables may use `_T`, `_P`, and similar short
  names.
- Public or constrained type variables must have descriptive names.
- Use `_co` and `_contra` suffixes for covariant and contravariant variables.
- Do not use public single-letter `T` or `P` for type variables.

Good:

```python
from collections.abc import Callable
from typing import ParamSpec, TypeVar

_P = ParamSpec("_P")
_T = TypeVar("_T")
AddableType = TypeVar("AddableType", int, float, str)
AnyFunction = TypeVar("AnyFunction", bound=Callable)
```

### Forward references

Rules:

- Prefer `from __future__ import annotations` for forward references.
- Do not remove `from __future__ import annotations` only because newer Python
  versions defer annotation evaluation. A project on an earlier version keeps
  future annotations as its convention.
- Use string annotations only when future annotations are not available or when
  needed for a type-checking-only import pattern.
- Avoid type-only circular imports. They are design pressure to move shared
  contracts.

Good:

```python
from __future__ import annotations

class Node:
    def __init__(self, parent: Node | None = None) -> None:
        self.parent = parent
```

Acceptable when avoiding a runtime import strictly for typing:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from external_package import ExternalType

def build(value: "ExternalType") -> str:
    ...
```

### Protocols and interfaces

Rules:

- Prefer `typing.Protocol` for structural interfaces used by a consumer.
- Keep protocols narrow. Define only the attributes and methods the consumer
  needs.
- Place a protocol near the consumer when it describes what that consumer needs,
  not what an implementation happens to provide.
- Use `@runtime_checkable` only when runtime `isinstance()` checks are truly
  needed.
- Use abstract base classes when nominal identity, runtime instantiation checks,
  or a standard-library ABC contract is the real requirement.
- Do not use an abstract base class to share implementation code.
- Do not mix interface definition with subclass-based code sharing.
- Implementations do not need to import or subclass a protocol for type checkers
  to recognize that they satisfy it.

Good:

```python
class Reader(Protocol):
    def read(self) -> str:
        ...

def print_reader(reader: Reader) -> None:
    print(reader.read())
```

Good implementation:

```python
class FileReader:
    def read(self) -> str:
        return "contents"
```

### Variable annotations

Rules:

- Use variable annotations when the inferred type is unclear or impossible.
- Use one space after the colon.
- Do not use a space before the colon.
- If assigning a value, use one space around `=`.

Good:

```python
examples: list[PromptExample] = []
label_by_name: dict[str, int] = {}
```

### Ignoring type errors

Rules:

- Avoid `# type: ignore`.
- If an ignore is necessary, keep it line-scoped.
- Include the specific error code when the type checker supports it.
- Do not keep unused ignores.
- Prefer refactoring or a clearer annotation over suppressing a type error.

Good:

```python
value = untyped_api()  # type: ignore[no-any-return]
```
