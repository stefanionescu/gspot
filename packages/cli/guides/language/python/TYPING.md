---
layer: language
kit: python
title: Python Typing
---

# Python Typing

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Type annotations, `Any`, generics, aliases, protocols, and type-checker suppressions. The module and
interface rules are in the Python file.

## Type annotations

Type annotations improve readability and catch type-related errors. They are
especially important for public APIs, stable code, complex data shapes, and
model or data boundaries.

### Annotation scope

<!-- level: all -->

Rules:

- Annotate every parameter and every return value of every function and method, including
  private helpers and `__init__` (`-> None`). The generated type-checker configuration
  selects annotation requirements for this enforcement level.
- Do not annotate `self` or `cls` unless needed for precise typing.
- Use `Any` only when the type is genuinely unconstrained or cannot be
  expressed clearly.
- Do not add obsolete `# type:` comments.
- Prefer the modern shorthand syntax over older `typing.Union`,
  `typing.Optional`, `typing.List`, `typing.Dict`, and `typing.Type` aliases.

Good:

```python
"""Group labeled records while preserving their key types."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Hashable, Iterable


def group_records[Key: Hashable](records: Iterable[tuple[Key, str]]) -> dict[Key, list[str]]:
    """Group record values under their original keys."""
    grouped: dict[Key, list[str]] = {}
    for key, value in records:
        grouped.setdefault(key, []).append(value)
    return grouped
```

The `group_records` example requires Python 3.12 or later for its type parameter syntax.
The `Key` parameter connects input keys to output keys; `Hashable` establishes
the dictionary-key requirement.

Private helpers follow the same annotation requirements as public functions.

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

For a FastAPI query field, `Annotated[str | None, Query(max_length=50)]`
attaches a length constraint to the type. Import `Annotated` and `Query` from
their owners and put an optional default on the endpoint parameter.

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

An object formatter accepts `object` when it only calls `str` or narrows
known types. A callback whose result is discarded can have an `object`
return type. Neither case requires `Any`.

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

The `group_records` module accepts `Iterable` and returns `dict`. It does not
require callers to create a list merely to satisfy an input annotation.

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

Import `Iterable`, `Mapping`, and `Sequence` from `collections.abc`. Keep
annotation-only imports under `TYPE_CHECKING` when the runtime does not inspect
them. Frameworks that inspect annotations need those names available at runtime.

### None and optional values

Rules:

- Use explicit `X | None` for nullable values.
- Put `None` last in union annotations.
- Do not rely on implicit optional inference from a default of `None`.
- Use `is None` and `is not None` for None checks.
- When a parameter is nullable and has a default, annotate it as nullable.

For an optional filesystem input, use `Path | None = None`. Handle the
`None` branch before calling path methods. A default path belongs to the
configuration owner, not to an undeclared example variable.

### Generic types

Rules:

- Specify type parameters for generic types.
- Do not write bare `Sequence`, `Mapping`, `list`, or `dict` unless the element
  type is intentionally unconstrained and made explicit with `Any`.
- Prefer `TypeVar` when a relationship between input and output types matters.

Annotate an employee identifier sequence as `Sequence[int]` when identifiers
are integers. If several key types are supported, connect the input and return
types with one bounded type parameter.

The `Key` parameter in `group_records` preserves the caller's key type.
Do not replace the return key type with an unrelated `str` annotation.

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

A repeated mapping of metric names to numeric values can use the alias
`MetricMap` for `Mapping[str, float]`. An assignment of `pathlib.Path` to
`Path` is a class alias, and `errno.EEXIST` is an error-code value; neither
is a new typing contract.

### Type variables

<!-- level: all -->

Rules:

- Private unconstrained type variables may use `_T`, `_P`, and similar short
  names.
- Public or constrained type variables must have descriptive names.
- Use `_co` and `_contra` suffixes for covariant and contravariant variables.
- Do not use public single-letter `T` or `P` for type variables.

Use `ParamSpec` when forwarding a callable's parameters, and bind a callable
type to the signature the consumer needs. A bare `Callable` hides argument
and return types. Use a descriptive bound parameter such as `Key` when it
is part of a public generic contract.

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
"""Represent an acyclic parent chain."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Node:
    """One node whose parent chain is acyclic.

    Attributes:
        name: Display name of this node.
        parent: Parent node, or None for a root.

    """

    name: str
    parent: Node | None = None

    def lineage(self) -> list[str]:
        """Return names from this node toward the root."""
        names: list[str] = []
        current: Node | None = self
        while current is not None:
            names.append(current.name)
            current = current.parent
        return names
```

A `TYPE_CHECKING` import with future annotations avoids a runtime import only
when the runtime does not need the imported symbol. Do not use that pattern
for validators or frameworks that evaluate those annotations.

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
"""Consume records through the reader contract needed by the caller."""

from typing import Protocol


class Reader(Protocol):
    """A source of one text document."""

    # gspot-ignore python/trivial-function -- Reader.read defines the required protocol signature.
    def read(self) -> str:
        """Return the document text."""
        ...


def unique_records(reader: Reader) -> list[str]:
    """Read sorted unique records, omitting blank lines."""
    records = {line.strip() for line in reader.read().splitlines()}
    records.discard("")
    return sorted(records)
```

The standard-library `io.StringIO` already satisfies `Reader`: it provides
`read() -> str`. Do not invent a constant-returning class merely to illustrate
protocol conformance.

### Variable annotations

Rules:

- Use variable annotations when the inferred type is unclear or impossible.
- Use one space after the colon.
- Do not use a space before the colon.
- If assigning a value, use one space around `=`.

An empty collection needs an annotation when its element type cannot be
inferred. The `names: list[str]` declaration in `Node.lineage` states that
contract without adding a redundant annotation to every intermediate value.

### Ignoring type errors

Rules:

- Avoid `# type: ignore`.
- If an ignore is necessary, keep it line-scoped.
- Include the specific error code when the type checker supports it.
- Do not keep unused ignores.
- Prefer refactoring or a clearer annotation over suppressing a type error.

If an external typing defect requires an ignore, name the actual checker
diagnostic and explain the external constraint. Keep a neighboring valid
diagnostic enabled and remove the ignore once its cause is corrected.
