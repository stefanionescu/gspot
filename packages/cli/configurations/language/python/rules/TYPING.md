# Python Typing

## Annotations

<!-- level: all -->

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
compiler cannot infer a clear type, such as an empty collection, not on every
intermediate value.

`typing.Annotated` attaches framework or validation metadata to a real type, real type
first. The default stays an ordinary parameter default and never repeats in the
metadata object. Arbitrary string metadata never replaces a domain type or validator. A
FastAPI query field reads `Annotated[str | None, Query(max_length=50)] = None`.

## Any, object, and shapes

Use `object` for a value of any type when the function only uses operations
every object has, such as passing it to `str()`. Also use it for an ignored callback
result. Reserve `Any` for a type the type system cannot express, a correct type that makes the
API unreasonable, or a value that intentionally escapes checking. Never use it as a shortcut; a
protocol, type variable, overload, or small value object models the contract first.

Arguments take protocols and abstract collections from `collections.abc`, such as `Iterable`,
`Sequence`, `Mapping`, or `Callable`, and `object` for any value. Concrete implementations return
concrete types such as `list`, `dict`, or a dataclass. Protocols and abstract base classes choose
return types by the promised interface. A union return that forces callers into an immediate
`isinstance()` branch becomes separate functions, a tagged dataclass, a protocol, or a small
hierarchy with a common contract.

Use `float` for numeric APIs that also accept integers. Use `str` for text and `bytes` for binary data.
`AnyStr` ties several annotations to one text or binary type.

A `Path | None = None` input handles its `None` branch
before calling path methods, and the default path belongs to the configuration owner. Generic
types name their parameters, such as `Sequence[int]`. A bare `Sequence` or `dict` exists only when
the element type intentionally accepts any type and says so with `Any`. A `TypeVar` connects
input and output types when that relationship matters, as `Key` does above.

## Aliases, variables, and forward references

A type alias names a complex repeated type in CapWords, with a leading underscore when
internal. It uses a `type` statement when the Python version supports it and the module
already uses it, or `TypeAlias` where a syntax change falls outside the task. `MetricMap` for
`Mapping[str, float]` names an alias; `Path = pathlib.Path` names a class alias and `errno.EEXIST` a
value, and neither defines a typing interface.

### Type variable naming

<!-- level: all -->

A private unconstrained type variable can use `_T` or `_P`; a public or constrained one has a
descriptive name such as `Key`, with `_co` and `_contra` for variance, and no public
single-letter `T` or `P`. `ParamSpec` forwards a callable's parameters. Give a `Callable` the
signature its consumer needs; do not leave it bare.

### Forward references

`from __future__ import annotations` handles forward references and stays as the project's
convention even where newer Python defers evaluation. String annotations exist only where
the runtime does not provide future annotations or a type-checking-only import needs them. A
`TYPE_CHECKING` import avoids a runtime import only when the runtime does not need the
symbol. Validators and frameworks that evaluate annotations need the real import. A type-only circular
import signals a need to move the shared contract.

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

## Protocols

Define a structural interface with a narrow `typing.Protocol` near the consumer, with
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
