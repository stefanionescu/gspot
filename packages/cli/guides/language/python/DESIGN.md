---
layer: language
configuration: python
title: Python Design
---

# Python Design

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Functions, methods, classes, dataclasses, inheritance, and decorators. The module and interface
rules are in the Python file.

## Functions and methods

Rules:

- Do not hide I/O in helpers that look like pure transformations.

### Function names

<!-- level: all -->

Keep functions focused on one responsibility. Prefer plain functions and explicit data flow
before classes. Make side effects clear in the name or docstring.

Name functions for their action and domain concept. Use framework callback names where required.
Prefer a specific operation over vague verbs when the caller can understand that operation.

### Function size

<!-- level: all -->

Rules:

- Keep functions small and focused.
- Function and method length stay under the configured limit.
- If a function approaches the limit, consider extracting real sub-operations.
- Do not split a function into meaningless helpers only to satisfy the count.
- Extract helpers when the extracted operation has a clear name and contract.

Good extraction for a nonnegative message limit:

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

### Default arguments

Rules:

- Do not use mutable objects as default argument values.
- Use `None` as the default and create the mutable value inside the function.
- Immutable defaults such as `None`, strings, numbers, booleans, and tuples are
  allowed.
- Do not use dynamic values such as `time.time()` as defaults.
- Do not use parsed flag values, environment-dependent values, or mutable global
  values as defaults.
- When an annotated parameter has a default, put spaces around `=`.
- When an unannotated parameter has a default, do not put spaces around `=`.

Good:

```python
"""Create an independently mutable collection from optional label input."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence


def collect_labels(labels: Sequence[str] | None = None) -> list[str]:
    """Return a new list containing the supplied labels, or an empty list."""
    if labels is None:
        labels = []
    return list(labels)


__all__ = ["collect_labels"]
```

Write an annotated default as `width: int = 0`; the annotation and assignment
have their normal spacing. Do not publish an empty function solely to
demonstrate signature formatting.

### Return statements

Rules:

- Be consistent in return statements.
- If any return statement returns a value, every no-value path explicitly
  return `None` or end in a clear final return.
- Do not mix `return` and `return value` in the same function.
- Do not rely on implicit `None` when an explicit no-result path is meaningful.

If a numeric operation accepts values outside its domain as ordinary input,
declare the no-result case in its return type and return `None` explicitly.
Use a specific exception instead when invalid input violates the API contract.

### Nested functions and classes

<!-- level: all -->

Rules:

- Nested functions are allowed when they close over a local value and make the
  outer function clearer.
- Nested classes are allowed for narrowly scoped helper types.
- Do not nest a function only to hide it from users.
- Prefer a module-level private helper when tests or reuse need direct access.
- Avoid nested functions that make the outer function long or hard to scan.

A closure can capture an owned value when a caller needs a function value.
Keep the captured state and lifetime explicit. Do not create a nested function
only to turn a directly usable expression into a local call.

Inline a conversion at its caller when a named helper only forwards that conversion.

### Lambda functions

<!-- level: all -->

Rules:

- Lambdas are allowed for simple one-line expressions.
- Do not bind a lambda directly to a name. Use `def`.
- Prefer generator expressions over `map()` or `filter()` with a lambda.
- Use functions from `operator` for common operations when they are clearer.
- If a lambda spans multiple lines or becomes hard to read, use a named
  function.

An inline sorting key such as `lambda item: item.name` expresses its callback
contract at the consumer. A named function that only doubles a number adds
indirection unless its function identity or shared calculation is required.

### Conditional expressions

<!-- level: all -->

Rules:

- Conditional expressions are allowed for simple cases.
- Each portion is easy to read: true expression, condition, false
  expression.
- Use a full `if` statement when the expression becomes long or nested.

For a binary presentation choice, `"stream" if is_streaming else "batch"`
keeps the condition and both values together. Use branches when either path
needs several operations.

### Comprehensions and generator expressions

<!-- level: all -->

Rules:

- Use comprehensions for simple mapping or filtering.
- Do not use multiple `for` clauses or multiple filter expressions in one
  comprehension.
- Optimize for readability, not compactness.
- Use ordinary loops for nested logic, multiple conditions, mutation, or
  non-obvious transformations.
- Generator expressions are preferred when a list is not needed.

`[user.name for user in users if user is not None]` expresses one filter and
one transformation. Keep more involved validation and mutation in an ordinary
loop so their ordering remains visible.

Wrap a long comprehension across lines at its expression, `for`, and `if`
parts. Keep each part readable; wrapping does not justify nested iteration or
a complex predicate.

Use a loop:

```python
pairs: list[tuple[int, int]] = []
for x in range(10):
    for y in range(5):
        if x * y > 10:
            pairs.append((x, y))
```

### Generators

Rules:

- Use generators when values can be produced lazily.
- Describe yielded values using the configured docstring convention. The example uses Google style.
- If a generator manages an expensive resource, make cleanup explicit.
- Do not keep resource lifetime implicit in a partially consumed generator.

Use a generator expression directly when a consumer only needs a lazy
projection. A named generator is useful when it owns resource lifetime,
validation, or repeated behavior. Document the yielded values and cleanup
contract instead of adding a forwarding generator.

## Classes

### Class design

<!-- level: all -->

Rules:

- Prefer functions and data structures unless a class owns real state,
  invariants, or behavior.
- Keep related classes together when they form one cohesive contract, including
  schemas, exceptions, protocols, and their input/output records.
- Split modules by independent responsibilities, not by class count.
- Treat size limits as review prompts: document a justified limit adjustment
  rather than extracting forwarding wrappers only to reduce line counts.
- Do not create classes only to group static functions.
- Avoid `Manager`, `Processor`, `Helper`, and similar vague class names.
- Decide deliberately which attributes are public and which are internal.
- Use public attributes for simple data.
- Use one leading underscore for internal attributes.
- Avoid double-leading underscores unless protecting a base class from subclass
  name collisions.
- Focus on the shape of data before adding behavior.
- If a function coordinates work between multiple classes and no polymorphism is
  involved, keep it a function unless one class clearly owns the behavior.

Use a data record such as `Batch` below when the value owns data. An empty
class with only a domain name establishes no behavior or useful shape.

### Initialization and named constructors

Rules:

- Keep `__init__` small.
- `__init__` accepts the values the class needs, not complex external
  objects that happen to contain those values.
- Do not couple a class constructor to database rows, ORM objects, API payloads,
  CLI namespaces, or provider SDK response objects.
- Use classmethod named constructors for external representations, such as
  `from_row`, `from_payload`, `from_token`, or `from_path`.
- Do not construct business objects with `ClassName(**external_attributes)` when
  that couples the class to an external storage or wire format.
- Validation of class invariants belongs in initialization.
- Complex loading, serialization, deserialization, and validation systems
  stay outside the business object.
- Derived attributes are cheap, deterministic, and based on already
  initialized fields. Prefer a named constructor when deriving them requires I/O,
  external services, or complex parsing.

A named constructor such as `from_row` translates an external representation
when the class owns that conversion. Do not add a constructor that merely
forwards the same fields to an already sufficient initializer.

### Dataclasses

Rules:

- Use dataclasses for plain data records.
- Keep dataclass fields typed.
- At `all`, document public fields using the configured docstring convention.
  Google style uses `Attributes:`; NumPy style uses an underlined `Attributes` heading.
- Do not add methods to a dataclass unless they are part of the data contract.
- Do not use a dataclass as a disguised mutable global configuration object.
- Use `field(default_factory=...)` for mutable defaults.
- Use `__post_init__` for simple invariant checks or cheap derived fields.
- Prefer a named constructor over `__post_init__` when construction needs
  parsing, I/O, external objects, or multiple alternate sources.
- If a project already uses `attrs`, apply the same principles: use factories
  for mutable defaults, validators for invariants, converters for simple input
  normalization, and named constructors for complex creation paths.
- Do not introduce `attrs` solely to avoid writing a small dataclass or ordinary
  function.

A frozen dataclass expresses a value that does not change after construction.
Document its public fields and keep provider identifiers distinct from
display names.

Good mutable default:

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

### Properties

Rules:

- Use properties only for cheap, straightforward, unsurprising attribute access.
- Do not use a property only to get and set an internal attribute.
- Do not hide expensive work behind attribute syntax.
- Do not hide side effects behind properties.
- Use `@property`; do not manually implement descriptors unless the power
  feature is necessary.
- Avoid properties for computations subclasses may need to override and extend.

A computed size property can describe "The number of examples." Keep the
calculation cheap and free of side effects. Do not introduce a property merely
to rename another stored attribute.

### Inheritance

Rules:

- Design explicitly for inheritance or avoid inheritance.
- Prefer composition over inheritance for code sharing.
- Do not subclass only to reuse methods or state.
- Do not use the template method pattern as a default design. A base class that
  defines control flow and calls subclass hooks is harder to read and easier to
  break than a wrapper with explicit delegation.
- Do not mix three different inheritance purposes in one hierarchy: code
  sharing, interface definition, and specialization.
- Use protocols or small ABCs for interfaces.
- Use specialization only when the subclass truly is the base class plus more
  and can be used anywhere the base class is expected.
- Follow the Liskov substitution principle: callers that accept the base class
  must be able to interact correctly with the subclass.
- Keep strict specialization hierarchies shallow and physically close together.
- Do not model variants as one class with a type field and many optional fields
  that only apply for some type values.
- Make invalid states unrepresentable.
- Use composition when behavior varies across more than one axis.
- Use a wrapper when you need one behavior plus cross-cutting behavior such as
  tracking, caching, timing, or logging.
- Consider `functools.singledispatch` when an operation varies by type but does
  not clearly belong to one class.
- Public attributes have no leading underscore.
- Internal attributes use one leading underscore.
- Double-leading underscores are only for avoiding accidental subclass name
  collisions.
- If a class is intended for subclassing, document the public API and subclass
  API separately when that distinction matters.

Use specialization only when every instance of the subtype satisfies the
base contract. Adding unrelated state or requiring callers to inspect the
subtype is evidence that composition or a separate record is clearer.

A tracking repository can delegate a real persistence operation and then
record its outcome. Record successful completion only after the operation
succeeds. A wrapper that adds no behavior belongs at its existing owner.

### Decorators

Rules:

- Use decorators when they remove real repetition or express a clear framework
  contract.
- Decorator behavior must be unsurprising.
- Decorators run at definition time, which is import time. Do not let them depend
  on files, sockets, databases, network calls, or other unavailable resources.
- Decorators preserve function metadata when wrapping functions.
- Use `classmethod` for named constructors or class-specific routines.
- Use `@property` only under the property rules above.

Use `classmethod` for a named constructor that validates or converts an
external representation. Do not add a constructor that only renames the
ordinary initializer.

### Method ownership

<!-- level: all -->

Keep stateless transformations as module functions only when they own substantive or
shared behavior. Call native operations directly when a wrapper adds no contract.
Do not introduce a class solely to contain static methods.

### Exceptions as classes

Rules:

- Custom exceptions inherit from `Exception`.
- Do not inherit directly from `BaseException`.

### Exception naming

<!-- level: all -->

Exception class names use CapWords and end with `Error`. Do not repeat the module name.
Describe the represented condition in the docstring.

Use `InvalidVariantError` for an unsupported variant, with a docstring such
as "The requested variant is not supported." Keep the exception beside the
behavior that raises it instead of creating a one-declaration file.
