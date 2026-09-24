---
layer: language
configuration: python
title: Python Flow
---

# Python Flow

Exceptions, assertions, comparisons, control flow, iteration, strings, logging, and resources.

## Exceptions and error handling

Rules:

- Use built-in exception classes when they fit the error.
- Raise `ValueError` for invalid argument values.
- Raise `TypeError` for invalid argument types when type validation is needed.
- Keep `try` blocks as small as possible.
- Catch specific exceptions.
- Do not use bare `except:`.
- Do not catch `Exception` unless re-raising or creating a deliberate isolation
  boundary that records and suppresses failures.
- Use `else` when code runs only if the `try` block succeeds.
- Use `finally` for cleanup that must run regardless of success or failure.
- Do not use `return`, `break`, or `continue` in a `finally` block when an
  exception can be active.
- Use `raise NewError(...) from error` when replacing an exception but preserving
  the cause.
- Use `raise NewError(...) from None` only when deliberately suppressing an
  irrelevant implementation exception, and preserve relevant details in the new
  message.
- When catching operating-system errors, prefer Python's explicit OSError
  subclass hierarchy over checking `errno` manually.

Good:

```python
try:
    value = collection[key]
except KeyError:
    return key_not_found(key)
else:
    return handle_value(value)
```

Good exception replacement:

```python
try:
    raw_value = payload["label"]
except KeyError as error:
    raise ValueError("Missing required field: label") from error
```

## Assertions

Rules:

- Do not use `assert` for application logic, input validation, permission
  checks, or required preconditions.
- Do not rely on `assert` to satisfy type checking or runtime correctness.
- `assert` is acceptable in pytest tests.
- `assert` is acceptable for non-critical internal consistency checks where
  removing it does not change application behavior.
- Use explicit `if` checks and raise exceptions for real validation.

Good:

```python
def connect_to_port(minimum: int) -> int:
    """Connect to the next available port."""
    if minimum < 1024:
        raise ValueError(f"Minimum port must be at least 1024: {minimum=}")
    port = find_next_open_port(minimum)
    if port is None:
        raise ConnectionError(f"Could not connect on or above port: {minimum=}")
    assert port >= minimum
    return port
```

## Boolean logic and comparisons

Rules:

- Compare to `None` with `is None` or `is not None`.
- Do not compare booleans to `True` or `False`.
- Use truthiness for sequences and containers.
- When handling integers, compare to `0` when zero has domain meaning.
- Do not write `if not value` when `None`, `0`, `False`, and empty containers
  have different meanings.
- Use `is not` instead of `not ... is`.
- Use `isinstance()` for type checks.
- Use `startswith()` and `endswith()` for prefix and suffix checks.
- Do not compare types directly unless exact type identity is the real contract.
- For rich ordering, implement all relevant comparison operations or use
  `functools.total_ordering()`.

Good:

```python
if value is not None:
    ...

if not examples:
    ...

if count == 0:
    ...

if isinstance(obj, int):
    ...

if filename.endswith(".json"):
    ...
```

NumPy arrays may reject implicit boolean evaluation. Use `.size` or another
explicit property when checking array emptiness.

## Control flow simplification

Rules:

- Reduce nesting when a condition can be merged without changing behavior.
- Merge adjacent `if` statements when the inner condition has no intervening
  work and no `else` branch that changes the result.
- Prefer guard clauses when they remove a level of nesting and keep the main
  path easy to scan.
- Hoist repeated code out of conditional branches when it runs in every branch.
- Hoist loop-invariant statements out of `for` and `while` loops when they do
  not depend on the loop variable and have no required repeated side effect.
- Do not combine conditions when separate conditions communicate distinct
  domain decisions more clearly.
- Do not hoist code when execution order, exceptions, logging, timing, database
  calls, or mutation change.

Good merged condition:

```python
if is_enabled and has_examples:
    return build_examples()
```

Good hoisted branch code:

```python
if sold > DISCOUNT_AMOUNT:
    total = sold * DISCOUNT_PRICE
else:
    total = sold * PRICE
label = f"Total: {total}"
```

Good loop-invariant hoist:

```python
city = "London"
for building in buildings:
    addresses.append((building.street_address, city))
```

## Iteration and collections

Rules:

- Use default iterators and membership operators for containers that support
  them.
- Iterate dictionaries directly for keys.
- Use `.items()` when both keys and values are needed.
- Do not call `.keys()` only to iterate keys.
- Do not call `.readlines()` only to iterate file lines.
- Do not mutate a container while iterating over it.
- Prefer clear loops over dense collection transformations.
- Use `yield from iterable` instead of a loop that only yields every item from
  another iterable.
- Use `any()` and `all()` for simple existence or universal predicate checks.
- Use `[]` for an empty list and `{}` for an empty dictionary.
- Use `list()` or `dict()` when converting an iterable or mapping, not for empty
  literals.

Good:

```python
for key in values:
    ...

for key, value in values.items():
    ...

for line in file_obj:
    ...

if item in values:
    ...
```

Good delegated yield:

```python
def get_content(entry: Entry) -> Iterable[Block]:
    yield from entry.get_blocks()
```

Good predicate check:

```python
found = any(thing == expected for thing in things)
all_valid = all(is_valid(thing) for thing in things)
```

Good empty containers:

```python
items = []
metadata = {}
```

## Strings, logging, and error messages

### String formatting

Rules:

- Use f-strings, `%` formatting, or `.format()` for formatting.
- Prefer f-strings for ordinary string interpolation.
- Do not use `+` to format strings with values.
- A single `a + b` concatenation is allowed when both values are already strings
  and this is not formatting.
- Do not accumulate strings with `+` or `+=` in a loop.
- Accumulate parts in a list and `"".join(parts)`, or use `io.StringIO`.
- Use implicit literal concatenation inside parentheses for long string
  literals.

Good:

```python
from html import escape

message = f"name: {name}; score: {score}"

rows = ["<table>"]
for last_name, first_name in employees:
    rows.append("<tr><td>%s, %s</td></tr>" % (escape(last_name), escape(first_name)))
rows.append("</table>")
employee_table = "".join(rows)
```

### Logging

Rules:

- Create loggers with `logging.getLogger(__name__)`.
- Use module-level loggers. Logger names track the package and module
  hierarchy through `__name__`.
- Do not log through the root logger from application or library modules.
- Use `print()` for ordinary CLI output intended for the user.
- Use `logger.debug()` for detailed diagnostic information.
- Use `logger.info()` for normal operational events and status.
- Use `logger.warning()` when something unexpected happened but the software can
  still continue as expected.
- Use `warnings.warn()` in library code when client code must change to avoid
  the issue.
- Raise an exception to report an error that prevents the requested operation.
- Use `logger.error()`, `logger.exception()`, or `logger.critical()` when an
  error is deliberately suppressed at an isolation boundary and must be recorded.
- Use `logger.exception()` only inside an exception handler.
- Logging calls that accept pattern strings must use a string literal first
  argument and pass values as later arguments.
- Do not use f-strings in logging pattern calls.
- Do not call logging once for the static text and once for the value.
- Do not eagerly compute expensive logging arguments unless the log level is
  enabled. Use `logger.isEnabledFor(...)` around expensive diagnostic work.
- Configure handlers, formatters, and levels at the application entrypoint or
  deployment boundary, not in importable library modules.
- Call `logging.basicConfig()` before logger methods are called when an
  entrypoint uses basic configuration.
- If dictionary or file logging configuration is used, set
  `disable_existing_loggers` deliberately.
- Library modules must not add handlers other than `logging.NullHandler()` to
  their own top-level logger.
- Do not define custom logging levels unless there is a documented application
  need.
- Do not log secrets, tokens, passwords, PII, or full authenticated request
  bodies.
- Keep log messages precise and searchable.

Good:

```python
logger.info("Warmup prompts: %d", num_prompts)
logger.warning("Requested max_length=%d exceeds model limit; clamping to %d", requested, effective)
```

Good expensive debug logging:

```python
if logger.isEnabledFor(logging.DEBUG):
    logger.debug(
        "Tokenization details: %s",
        build_expensive_tokenization_summary(batch),
    )
```

Good exception logging:

```python
try:
    upload_model(model_dir)
except UploadError:
    logger.exception("Model upload failed")
    raise
```

### Error messages

Rules:

- Error messages must match the actual error condition.
- Interpolated values must be clearly identifiable.
- Prefer `name=value` formatting for values that aid debugging.
- Keep messages easy to grep.
- Start user-visible messages with an uppercase letter.
- Do not leak schema names, table names, file paths, internal IDs, stack traces,
  trigger names, policy names, secrets, or implementation details.
- Use generic messages for configuration and infrastructure failures unless the
  details are part of the public contract.

Good:

```python
if not 0 <= probability <= 1:
    raise ValueError(f"Not a probability: {probability=}")
```

Good logging around OS errors:

```python
try:
    workdir.rmdir()
except OSError as error:
    logger.warning("Could not remove directory (reason: %r): %r", error, workdir)
```

## Files and stateful resources

Rules:

- Explicitly close files, sockets, database connections, mmap mappings, h5py
  files, matplotlib figures, and similar stateful resources.
- Prefer `with` statements for resources that support context management.
- Use `contextlib.closing()` for closeable resources without context-manager
  support.
- Do not rely on finalizers or garbage collection for resource cleanup.
- Keep resource scope as small as practical.
- Do not return open resources from helpers unless resource ownership is part of
  the documented contract.
- Document resource lifetime when context-based management is infeasible.

Good:

```python
with path.open(encoding="utf-8") as file_obj:
    for line in file_obj:
        handle_line(line)
```

Good for closeable objects without context-manager support:

```python
import contextlib

with contextlib.closing(open_remote_resource(url)) as resource:
    consume(resource)
```
