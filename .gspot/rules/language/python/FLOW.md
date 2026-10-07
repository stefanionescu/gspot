---
title: Python Flow
---

# Python Flow

Exceptions, assertions, comparisons, control flow, iteration, strings, logging, and resources.

## Exceptions and error handling

Use explicit validation for external inputs and required preconditions. Avoid exceptions for
ordinary branching when the value can be checked directly.

The following module accepts only bounded positive decimal integers and preserves the original
conversion error.

Good:

```python
"""Validate limits supplied by a command or environment variable."""

MAX_BATCH_SIZE = 1000


def parse_batch_limit(raw: str) -> int:
    """Return a positive batch limit within the supported range."""
    try:
        value = int(raw)
    except ValueError as error:
        message = "Batch limit must be a decimal integer."
        raise ValueError(message) from error
    if not 1 <= value <= MAX_BATCH_SIZE:
        message = f"Batch limit must be between 1 and {MAX_BATCH_SIZE}."
        raise ValueError(message)
    return value
```

### Exception message conventions

<!-- level: all -->

Keep the exception's public contract stable when changing its message.

## Exception contracts

A custom exception inherits from `Exception`, describes its condition in the docstring, and
lives beside the behavior that raises it rather than in a one-declaration file.

Do not substitute a built-in exception for an external API's declared error type. Follow a
library's public error contract when callers depend on it.

## Assertions

Keep assertions in tests. Use explicit validation for required application checks.

## Boolean logic and comparisons

Compare singleton values with `is None`, `is not None`, `is True`, or `is False` when identity is
the intended contract. Use truth-value testing only when all falsy values mean the same thing.
An empty collection, zero, and a missing value are not interchangeable by default.

Use `==` for value equality. Use membership tests for supported containers, and avoid chained
comparisons whose repeated values have side effects. Keep evaluation order and short-circuit
behavior intact when simplifying a condition.

### Control-flow conventions

<!-- level: all -->

Prefer direct predicates and early exits when they reduce nesting. Keep multi-step branches
as statements.

## Iteration and collections

Iterate containers through their supported interfaces. Do not mutate a collection in a way
that invalidates the current iteration.

Read file objects as iterators instead of loading all lines when the operation can stream them.
Use `yield from` to delegate an iterator, and `any()` or `all()` for short-circuit predicate checks.
Keep comprehensions limited to transformations whose order and side effects remain clear.

Choose concrete return values or lazy iteration according to the caller's resource and reuse
requirements, not solely to shorten the implementation.

## Strings and output

Use f-strings for ordinary value interpolation. Preserve formatting required by an external API,
and keep logging arguments separate from the message when the logging API formats them lazily.
Use efficient joining for a sequence of strings instead of repeatedly growing a large string.

Formatting is not validation or escaping. Use parameterized database queries, argument arrays
for subprocesses, and the appropriate encoder for HTML, JSON, or another output format.

## Files and stateful resources

Use context managers for resources with an explicit lifetime. Close files and network resources
on both success and failure. Declare text encoding when opening a text file. Use binary mode
for bytes instead of relying on an implicit conversion.

A generator can keep a resource open while suspended. Make that lifetime clear to callers,
especially when they can stop consuming it early. This command reads the path supplied as its
first argument and closes the input before printing the collected records.

Good:

```python
"""Read normalized, nonempty records from a text file."""

import sys
from pathlib import Path


def main() -> int:
    """Read the first argument as a path and print its normalized records."""
    path = Path(sys.argv[1])
    with path.open(encoding="utf-8") as source:
        records = [record for line in source if (record := line.strip())]
    _ = sys.stdout.write("\n".join(records))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

For large inputs, provide an explicit streaming interface whose caller owns the open resource
or uses a context manager. Do not materialize the full input merely to avoid documenting its
lifetime.

Write to a temporary file in the same folder, validate it, then rename it over the target. Clean up only paths and resources owned by the current operation.
