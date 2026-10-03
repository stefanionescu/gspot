---
title: Python Typing
---

# Python Typing

Annotations, `Any`, generics, aliases, protocols, and suppressions. Module and interface rules
are in the Python file. The type checker reports missing annotations at the configured level
and unused ignores; Ruff reports the deprecated `typing` aliases, `Optional` and `Union`
spellings, implicit optional, bare `# type: ignore`, annotation-only imports outside
`TYPE_CHECKING`, and annotation spacing. This file holds the decisions those rules cannot
judge.

## Annotations

<!-- level: all -->

Every parameter and return value of every function and method is annotated, including private
helpers and `__init__` (`-> None`); `self` and `cls` are annotated only for precise typing.

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

The type parameter syntax needs Python 3.12; `Key` connects input keys to output keys, and
`Hashable` states the dictionary-key requirement. A variable annotation appears where the
inferred type is unclear or impossible, such as an empty collection, not on every
intermediate value.

`typing.Annotated` attaches framework or validation metadata to a real type, real type
first. The default stays an ordinary parameter default and is never duplicated in the
metadata object. Arbitrary string metadata never replaces a domain type or validator. A
FastAPI query field reads `Annotated[str | None, Query(max_length=50)] = None`.

## Any, object, and shapes

`object` is the type of a value that can be anything when the function only uses operations
every object has, such as passing it to `str()`. It is also the type of an ignored callback
result. `Any` is reserved for a type that cannot be expressed, a correct type that makes the
API unreasonable, or a value that intentionally escapes checking. It is never a shortcut; a
protocol, type variable, overload, or small value object models the contract first.

Arguments take protocols and abstract collections from `collections.abc` (`Iterable`,
`Sequence`, `Mapping`, `Callable`) and `object` for any value. Concrete implementations return
concrete types (`list`, `dict`, a dataclass). Protocols and abstract base classes choose
return types by the promised interface. A union return that forces callers into an immediate
`isinstance()` branch becomes separate functions, a tagged dataclass, a protocol, or a small
hierarchy with a common contract.

Numeric APIs take `float` where integers are valid, and
`None` is written as `None`. Text is `str`, binary is `bytes`, and `AnyStr` ties several
annotations to one text or binary type. Built-in generics (`list[str]`, `tuple[str, ...]`,
`type`) and `|` unions replace the `typing` aliases, and annotation-only imports sit under
`TYPE_CHECKING` unless a framework inspects annotations at runtime.

A nullable value is an explicit `X | None` with `None` last, annotated even when the default
is `None`, and checked with `is None`. A `Path | None = None` input handles its `None` branch
before calling path methods, and the default path belongs to the configuration owner. Generic
types name their parameters (`Sequence[int]`). A bare `Sequence` or `dict` exists only when
the element type is intentionally unconstrained and says so with `Any`. A `TypeVar` connects
input and output types when that relationship matters, as `Key` does above.

## Aliases, variables, and forward references

A type alias names a complex repeated type in CapWords, with a leading underscore when
internal. It uses a `type` statement when the Python version supports it and the module
already uses it, or `TypeAlias` where changing syntax is unrelated churn. `MetricMap` for
`Mapping[str, float]` is an alias; `Path = pathlib.Path` is a class alias and `errno.EEXIST` a
value, and neither is a typing contract.

### Type variable naming

<!-- level: all -->

A private unconstrained type variable may be `_T` or `_P`; a public or constrained one has a
descriptive name such as `Key`, with `_co` and `_contra` for variance, and no public
single-letter `T` or `P`. `ParamSpec` forwards a callable's parameters, and a `Callable` is
bound to the signature its consumer needs rather than left bare.

### Forward references

`from __future__ import annotations` handles forward references and stays as the project's
convention even where newer Python defers evaluation. String annotations exist only where
future annotations are unavailable or a type-checking-only import needs them. A
`TYPE_CHECKING` import avoids a runtime import only when the runtime does not need the
symbol. Validators and frameworks that evaluate annotations need the real import. A type-only circular
import is design pressure to move the shared contract.

```python
@dataclass(frozen=True)
class Node:
    """One node whose parent chain is acyclic.

    Attributes:
        name: Display name of this node.
        parent: Parent node, or None for a root.

    """

    name: str
    parent: Node | None = None

    def list_lineage(self) -> list[str]:
        """Return names from this node toward the root."""
        names: list[str] = []
        current: Node | None = self
        while current is not None:
            names.append(current.name)
            current = current.parent
        return names
```

## Protocols and suppressions

A structural interface is a narrow `typing.Protocol` placed near the consumer and defining
only what that consumer needs; implementations satisfy it without importing or subclassing
it. `@runtime_checkable` exists only for a real `isinstance()` need, and an abstract base
class serves nominal identity, runtime instantiation checks, or a standard-library contract,
never shared implementation mixed with interface definition.

```python
class Reader(Protocol):
    """A source of one text document."""

    def read(self) -> str:
        """Return the document text."""
        ...


def read_unique_records(reader: Reader) -> list[str]:
    """Read sorted unique records, omitting blank lines."""
    records = {line.strip() for line in reader.read().splitlines()}
    records.discard("")
    return sorted(records)
```

`io.StringIO` already satisfies `Reader`; no constant-returning class is invented to show
conformance. A type error is fixed by refactoring or a clearer annotation. When an external typing defect
forces a `# type: ignore`, it is line-scoped and carries the checker's diagnostic code and the
external constraint. It leaves neighboring diagnostics enabled and goes when its cause is
corrected.
