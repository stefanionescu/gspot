---
title: Python Design
---

# Python Design

Functions, methods, classes, dataclasses, inheritance, and decorators. Module and interface
rules are in the Python file.

## Functions

I/O never hides in a helper that looks like a pure transformation. A no-result case that is
ordinary input is declared in the return type and returned as an explicit `None`; input that
violates the API contract raises a specific exception. A generator owns its resource lifetime
explicitly and documents its yielded values and cleanup contract. A partially consumed
generator never holds a resource implicitly. A generator expression serves a consumer that
only needs a lazy projection. Comprehensions serve one mapping or one filter; nested
logic, several conditions, mutation, or a non-obvious transformation gets an ordinary loop so
its ordering stays visible.

### Function conventions

<!-- level: all -->

A function owns one responsibility, is named for its action and domain concept (framework
callback names where required), and makes side effects clear in its name or docstring. Plain
functions and explicit data flow come before classes. A function near the size limit extracts
a sub-operation that has a real name and contract, never a helper that exists only to satisfy
the count:

```python
"""Select recent message text under a validated nonnegative limit."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence

def trim_history_messages(messages: Sequence[str], max_messages: int) -> list[str]:
    """Return at most the requested number of recent messages."""
    if max_messages == 0:
        return []
    if len(messages) <= max_messages:
        return list(messages)
    return list(messages[-max_messages:])

__all__ = ["trim_history_messages"]
```

A mutable default is `None`, with the value created inside the function
(`labels: Sequence[str] | None = None`), and no default depends on a parsed flag, the
environment, or mutable global state.

A nested function closes over a local value to make the outer function clearer, keeping its
captured state and lifetime explicit. It never exists to
hide a helper from users or to turn a directly usable expression into a local call. A
module-level private helper serves tests and reuse instead. A conversion that a named helper only
forwards is inlined at its caller.

A lambda is a one-line expression at its consumer, such as
a sorting key `lambda item: item.name`; a generator expression or `operator` function beats
`map()` or `filter()` with a lambda, and anything longer is a `def`. A conditional expression
holds a simple binary choice, `"stream" if is_streaming else "batch"`, and a path with several
operations gets `if` branches.

## Classes

A class exists for real state, invariants, or behavior; a coordinating function without
polymorphism stays a function, and static functions are never grouped into a class. Related
classes that form one contract, such as schemas, exceptions, protocols, and their records,
stay together, and modules split by independent responsibility rather than class count. A
size limit is a review prompt: a justified adjustment is documented instead of extracting
forwarding wrappers. Simple data has public attributes, internal attributes carry one leading
underscore, and a double underscore only protects a base class from subclass collisions.

`__init__` stays small, takes the values the class needs rather than the external objects
that carry them, and validates invariants. It is never coupled to database rows, ORM objects,
API payloads, CLI namespaces, or provider responses. An external representation enters
through a classmethod named constructor such as `from_row` or `from_payload` when the class
owns that conversion. `ClassName(**external_attributes)` is not that, and neither is a
constructor that only renames the initializer. Loading, serialization, and validation systems stay outside the
business object. A derived attribute is cheap, deterministic, and built from initialized
fields; deriving through I/O or complex parsing is a named constructor's job.

A dataclass is a typed plain data record with methods only from the data contract. Mutable
defaults use `field(default_factory=...)`, and `__post_init__` holds cheap invariants and
derived fields. A named constructor serves construction that needs parsing, I/O, or
alternate sources. It is never a disguised mutable global configuration object. A frozen dataclass
expresses a value fixed after construction. A project on `attrs` applies the same principles
through its factories, validators, and converters, and `attrs` is never introduced to avoid a
small dataclass or a function.

```python
"""Represent an independently owned batch of prompt text."""

from dataclasses import field, dataclass

@dataclass
class Batch:
    """Prompt text owned by one processing batch.

    Attributes:
        prompts: The text items assigned to this batch.

    """

    prompts: list[str] = field(default_factory=list)

__all__ = ["Batch"]
```

### Dataclass conventions

<!-- level: all -->

Public dataclass fields are documented in the configured docstring convention: Google style
uses `Attributes:`, NumPy style an underlined `Attributes` heading. A stateless
transformation is a module function only when it owns substantive or shared behavior, and a
native operation is called directly when a wrapper adds no contract.

A property is cheap, unsurprising attribute access with no side effects. It is never a
getter and setter over an internal attribute, expensive work, a rename of a stored attribute,
or a computation subclasses must override. `@property` beats a hand-written descriptor unless
that power is needed.

## Inheritance and decorators

A class is designed for inheritance or not inherited from. Composition shares code, and
protocols or small abstract base classes define interfaces. Specialization is reserved for a
subclass that is the base class plus more and is usable wherever the base is expected. A
hierarchy never mixes code sharing, interface definition, and specialization, stays shallow,
and lives physically together. The template method pattern is not a default: a base class
that defines control flow and calls subclass hooks is harder to read than a wrapper with
explicit delegation.

Variants are not one class with a type field and optional fields that apply to some values;
invalid states are unrepresentable. Behavior varying on more than one axis uses composition.
Cross-cutting behavior such as tracking, caching, timing, or logging uses a wrapper that
records completion only after the wrapped operation succeeds. An operation that varies by
type without a clear owner may use `functools.singledispatch`. A class meant for subclassing
documents its public API and its subclass API separately when the distinction matters.

A decorator removes real repetition or expresses a framework contract. It behaves
unsurprisingly and preserves function metadata. Because it runs at import time, it never
depends on files, sockets, databases, or network calls. `classmethod` marks named constructors and
class-specific routines.

## Exceptions

A custom exception inherits from `Exception`, describes its condition in the docstring, and
lives beside the behavior that raises it rather than in a one-declaration file.

### Exception naming

<!-- level: all -->

Its name is CapWords ending in `Error` without the module name: `InvalidVariantError`, "The
requested variant is not supported."
