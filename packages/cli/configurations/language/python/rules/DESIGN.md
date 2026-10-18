# Python Design

Read this rule when you write Python functions or classes.

## Functions

I/O never hides in a helper that looks like a pure transformation. Declare an ordinary no-result case in the signature and return an explicit `None`. Input that
violates the API contract raises a specific exception.

A generator owns its resource lifetime
explicitly and documents its yielded values and cleanup contract. A partially consumed
generator never holds a resource implicitly. A generator expression serves a consumer that
only needs a lazy projection. Comprehensions serve a single mapping or filter. Nested
logic, several conditions, mutation, or a transformation that needs explanation gets an ordinary loop so
its order stays visible.

### Function conventions

<!-- level: all -->

A function owns one responsibility. Name it for its action and domain concept. Framework callbacks keep their required names. Make side effects clear in its name or docstring. Plain
functions and explicit data flow come before classes.

When a function goes over a size limit, extract one step and name it for what it does. If the limit does not fit the code, ask the user to raise it:

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


__all__ = ['trim_history_messages']
```

A nested function closes over a local value to make the outer code clearer, and keeps its
captured state and lifetime explicit. It never exists to
hide a helper from users or to turn a directly usable expression into a local call. A
module-level private helper serves reusable logic that a nested function hides. When a named helper only
forwards a conversion, put its body at the call site.

Write a lambda as a one-line expression at its consumer, such as
a sorting key `lambda item: item.name`. Prefer a generator expression or `operator` function over
`map()` or `filter()` with a lambda. Use a `def` for anything longer. A conditional expression
holds one binary choice, `"stream" if is_streaming else "batch"`, and a path with several
operations gets `if` branches.

## Classes

A class exists for real state, invariants, or behavior. Do not turn a coordinating function
without polymorphism into a class. Never group static functions into a class.

Keep classes that form one contract together, for example schemas, exceptions, protocols,
and their records. Split modules by independent responsibility, not by class count. Plain
data has public attributes. Internal attributes carry one leading underscore. Use a double
underscore only to protect a base class from subclass collisions.

`__init__` stays small, takes the values the class needs rather than the external objects
that carry them, and validates invariants. Keep it separate from database rows, object-relational mapping (ORM) objects,
API payloads, CLI namespaces, or provider responses. An external representation enters
through a classmethod named constructor such as `from_row` or `from_payload` when the class
owns that conversion. Neither `ClassName(**external_attributes)` nor a
constructor that only renames the initializer handles that conversion.

Loading, serialization, and validation systems stay outside the
business object. Keep a derived attribute cheap and deterministic. Build it from initialized
fields; a named constructor handles derivation through I/O or complex parsing.

Use a dataclass as a typed plain record with methods only from its data contract. Mutable
defaults use `field(default_factory=...)`, and `__post_init__` holds cheap invariants and
derived fields. Use a named constructor when creation needs parsing, I/O, or
alternate sources.

Never use it to disguise a mutable global configuration object. A frozen dataclass
expresses a value fixed after construction. A project on `attrs` applies the same principles
through its factories, validators, and converters. Do not add `attrs` in place of a small dataclass or a function.

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


__all__ = ['Batch']
```

### Dataclass conventions

<!-- level: all -->

Document public dataclass fields in the configured docstring convention: `Attributes:` for
Google style, an underlined `Attributes` heading for NumPy.

A property provides cheap, unsurprising attribute access with no side effects. Never use it as a
getter and setter over an internal attribute, expensive work, a rename of a stored one,
or a computation subclasses must override. Prefer `@property` to a hand-written descriptor unless
the public interface requires one.

## Inheritance and decorators

Design a class for inheritance or forbid it. Composition shares code, and
protocols or small abstract base classes define interfaces. Reserve specialization for a
subclass that extends the base class and works wherever callers expect its parent. A
hierarchy never mixes code sharing, interface definition, and specialization, stays shallow,
and lives physically together. Do not default to the template method pattern. A base class
that defines control flow and calls subclass hooks takes more work to read than a function with
explicit delegation.

Do not put variants in one class with a type field and optional attributes that apply to some values.
Make invalid states unrepresentable. Behavior varying on more than one axis uses composition.
Cross-cutting behavior such as tracking, caching, timing, or logging uses a wrapper that
records completion only after the operation succeeds. An operation that varies by
type without one class that handles it may use `functools.singledispatch`. A class meant for subclassing
documents its public and subclass APIs separately when the distinction matters.

A decorator removes real repetition or expresses a framework contract. It behaves
unsurprisingly and preserves function metadata. Because it runs at import time, it never
depends on files, sockets, databases, or network calls. `classmethod` marks named constructors and
class-specific routines.
