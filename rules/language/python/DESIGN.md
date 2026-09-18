---
layer: language
preset: python
title: Python Design
---

# Python Design

Functions, methods, classes, dataclasses, inheritance, and decorators. The module and interface
rules are in the Python file.

## Functions and methods

Rules:

- Keep functions focused on one responsibility.
- Prefer plain functions and explicit data flow before classes.
- Name functions by action and domain concept.
- Do not use `process`, `handle`, `run`, `execute`, or `do_work` when a more
  precise action exists.
- Use `handle` only for callbacks, framework boundaries, event handlers, or
  signal handlers.
- Keep side effects explicit in the name or docstring.
- Do not hide I/O in helpers that look like pure transformations.

### Function size

Rules:

- Keep functions small and focused.
- The gate limits function and method length to the configured limit.
- If a function approaches the limit, consider extracting real sub-operations.
- Do not split a function into meaningless helpers only to satisfy the count.
- Extract helpers when the extracted operation has a clear name and contract.

Good extraction:

```python
def _trim_history_messages(
    messages: Sequence[HistoryMessage],
    max_messages: int,
) -> list[HistoryMessage]:
    if len(messages) <= max_messages:
        return list(messages)
    return list(messages[-max_messages:])
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
def collect_labels(labels: Sequence[str] | None = None) -> list[str]:
    if labels is None:
        labels = []
    return list(labels)
```

Good formatting:

```python
def resize(width: int = 0, height: int = 0) -> None:
    ...
```

### Return statements

Rules:

- Be consistent in return statements.
- If any return statement returns a value, every no-value path explicitly
  return `None` or end in a clear final return.
- Do not mix `return` and `return value` in the same function.
- Do not rely on implicit `None` when an explicit no-result path is meaningful.

Good:

```python
def safe_sqrt(value: float) -> float | None:
    if value < 0:
        return None
    return math.sqrt(value)
```

### Nested functions and classes

Rules:

- Nested functions are allowed when they close over a local value and make the
  outer function clearer.
- Nested classes are allowed for narrowly scoped helper types.
- Do not nest a function only to hide it from users.
- Prefer a module-level private helper when tests or reuse need direct access.
- Avoid nested functions that make the outer function long or hard to scan.

Good:

```python
def get_adder(summand: float) -> Callable[[float], float]:
    """Return a function that adds a fixed summand."""

    def add(value: float) -> float:
        return summand + value

    return add
```

Use a module helper instead:

```python
def _normalize_prompt(value: object) -> str:
    return str(value).strip()
```

### Lambda functions

Rules:

- Lambdas are allowed for simple one-line expressions.
- Do not bind a lambda directly to a name. Use `def`.
- Prefer generator expressions over `map()` or `filter()` with a lambda.
- Use functions from `operator` for common operations when they are clearer.
- If a lambda spans multiple lines or becomes hard to read, use a named
  function.

Good:

```python
def double(value: int) -> int:
    return value * 2

sorted_items = sorted(items, key=lambda item: item.name)
```

### Conditional expressions

Rules:

- Conditional expressions are allowed for simple cases.
- Each portion is easy to read: true expression, condition, false
  expression.
- Use a full `if` statement when the expression becomes long or nested.

Good:

```python
mode = "stream" if is_streaming else "batch"
```

### Comprehensions and generator expressions

Rules:

- Use comprehensions for simple mapping or filtering.
- Do not use multiple `for` clauses or multiple filter expressions in one
  comprehension.
- Optimize for readability, not compactness.
- Use ordinary loops for nested logic, multiple conditions, mutation, or
  non-obvious transformations.
- Generator expressions are preferred when a list is not needed.

Good:

```python
names = [user.name for user in users if user is not None]
```

Good with a long expression:

```python
valid_examples = [
    transform_example(example)
    for example in examples
    if is_valid_example(example)
]
```

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
- A generator docstring uses `Yields:`.
- If a generator manages an expensive resource, make cleanup explicit.
- Do not keep resource lifetime implicit in a partially consumed generator.

Good:

```python
def iter_prompt_text(examples: Iterable[PromptExample]) -> Iterable[str]:
    """Yield prompt text values.

    Yields:
        Prompt text values.
    """
    for example in examples:
        yield example.prompt
```

## Classes

### Class design

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

Good:

```python
class RuntimeBatch:
    """Tokenized prompts prepared for inference."""
```

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

Good:

```python
@dataclass
class Point:
    """Two-dimensional point."""

    x: float
    y: float

    @classmethod
    def from_row(cls, row: PointRow) -> Point:
        """Build a point from a database row."""
        return cls(x=row.x, y=row.y)
```

### Dataclasses

Rules:

- Use dataclasses for plain data records.
- Keep dataclass fields typed.
- Document public fields in the class docstring `Attributes:` section when the
  class is public.
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

Good:

```python
@dataclass(frozen=True)
class ModelVariant:
    """Supported model variant.

    Attributes:
        name: Stable variant name.
        base_model: Hugging Face base model identifier.
    """

    name: str
    base_model: str
```

Good mutable default:

```python
@dataclass
class Batch:
    """Batch of prompts."""

    prompts: list[PromptExample] = field(default_factory=list)
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

Good:

```python
@property
def num_examples(self) -> int:
    """The number of examples."""
    return len(self.examples)
```

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

Good specialization:

```python
@dataclass
class EmailAddress:
    """Email address shared by all address types."""

    id: UUID
    address: str

@dataclass
class Mailbox(EmailAddress):
    """Email address that stores mail."""

    password_hash: str
```

Good wrapper:

```python
class TrackingRepository:
    """Repository wrapper that records retrieved products."""

    def __init__(self, repository: Repository) -> None:
        self._repository = repository
        self.seen: set[Product] = set()

    def add_product(self, product: Product) -> None:
        self._repository.add_product(product)
        self.seen.add(product)
```

### Decorators

Rules:

- Use decorators when they remove real repetition or express a clear framework
  contract.
- Decorator behavior must be unsurprising.
- Decorators run at definition time, which is import time. Do not let them depend
  on files, sockets, databases, network calls, or other unavailable resources.
- Decorators preserve function metadata when wrapping functions.
- Avoid `staticmethod`. Use a module-level function instead.
- Use `classmethod` for named constructors or class-specific routines.
- Use `@property` only under the property rules above.

Good:

```python
class ModelConfig:
    @classmethod
    def from_name(cls, name: str) -> ModelConfig:
        """Build a model config from a variant name."""
        return cls(name=name)
```

Use a module function:

```python
def normalize_model_name(name: str) -> str:
    return name.strip().lower()
```

### Exceptions as classes

Rules:

- Custom exceptions inherit from `Exception`.
- Do not inherit directly from `BaseException`.
- Exception class names use CapWords.
- Error exception names end with `Error`.
- Exception names never repeat the module name.
- Exception docstrings describe the represented condition.

Good:

```python
class InvalidVariantError(Exception):
    """The requested model variant is not supported."""
```
