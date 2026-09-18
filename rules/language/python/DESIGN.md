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

- Keep functions focused on one responsibility. `unenforced`
- Prefer plain functions and explicit data flow before classes. `unenforced`
- Name functions by action and domain concept. `enforced-by: naming/identifiers`
- Do not use `process`, `handle`, `run`, `execute`, or `do_work` when a more
  precise action exists. `enforced-by: naming/identifiers`
- Use `handle` only for callbacks, framework boundaries, event handlers, or
  signal handlers. `enforced-by: naming/identifiers`
- Keep side effects explicit in the name or docstring. `enforced-by: python/ruff D`
- Do not hide I/O in helpers that look like pure transformations. `unenforced`

### Function size

Rules:

- Keep functions small and focused. `enforced-by: structure/function-length`
- The gate limits function and method length to the configured limit. `enforced-by: structure/function-length`
- If a function approaches the limit, consider extracting real sub-operations. `unenforced`
- Do not split a function into meaningless helpers only to satisfy the count. `enforced-by: structure/function-length`
- Extract helpers when the extracted operation has a clear name and contract. `enforced-by: structure/function-length`

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

- Do not use mutable objects as default argument values. `enforced-by: python/ruff B006`
- Use `None` as the default and create the mutable value inside the function. `enforced-by: python/ruff B006`
- Immutable defaults such as `None`, strings, numbers, booleans, and tuples are
  allowed. `unenforced`
- Do not use dynamic values such as `time.time()` as defaults. `enforced-by: python/ruff B006`
- Do not use parsed flag values, environment-dependent values, or mutable global
  values as defaults. `enforced-by: structure/no-singletons`
- When an annotated parameter has a default, put spaces around `=`. `enforced-by: python/basedpyright`
- When an unannotated parameter has a default, do not put spaces around `=`. `enforced-by: python/basedpyright`

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

- Be consistent in return statements. `enforced-by: python/ruff RET`
- If any return statement returns a value, every no-value path explicitly
  return `None` or end in a clear final return. `enforced-by: python/ruff RET`
- Do not mix `return` and `return value` in the same function. `unenforced`
- Do not rely on implicit `None` when an explicit no-result path is meaningful. `enforced-by: python/ruff RET`

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
  outer function clearer. `unenforced`
- Nested classes are allowed for narrowly scoped helper types. `unenforced`
- Do not nest a function only to hide it from users. `unenforced`
- Prefer a module-level private helper when tests or reuse need direct access. `enforced-by: structure/import-boundary`
- Avoid nested functions that make the outer function long or hard to scan. `unenforced`

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

- Lambdas are allowed for simple one-line expressions. `enforced-by: python/ruff E731`
- Do not bind a lambda directly to a name. Use `def`. `enforced-by: python/ruff E731`
- Prefer generator expressions over `map()` or `filter()` with a lambda. `enforced-by: python/ruff E731`
- Use functions from `operator` for common operations when they are clearer. `enforced-by: python/ruff E731`
- If a lambda spans multiple lines or becomes hard to read, use a named
  function. `enforced-by: python/ruff E731`

Good:

```python
def double(value: int) -> int:
    return value * 2

sorted_items = sorted(items, key=lambda item: item.name)
```

### Conditional expressions

Rules:

- Conditional expressions are allowed for simple cases. `enforced-by: python/ruff SIM108`
- Each portion is easy to read: true expression, condition, false
  expression. `unenforced`
- Use a full `if` statement when the expression becomes long or nested. `enforced-by: python/ruff SIM108`

Good:

```python
mode = "stream" if is_streaming else "batch"
```

### Comprehensions and generator expressions

Rules:

- Use comprehensions for simple mapping or filtering. `enforced-by: python/ruff C4`
- Do not use multiple `for` clauses or multiple filter expressions in one
  comprehension. `enforced-by: python/ruff C4`
- Optimize for readability, not compactness. `unenforced`
- Use ordinary loops for nested logic, multiple conditions, mutation, or
  non-obvious transformations. `enforced-by: python/ruff C4`
- Generator expressions are preferred when a list is not needed. `enforced-by: python/ruff C4`

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

- Use generators when values can be produced lazily. `enforced-by: python/ruff D`
- A generator docstring uses `Yields:`. `enforced-by: python/ruff D`
- If a generator manages an expensive resource, make cleanup explicit. `enforced-by: python/ruff D`
- Do not keep resource lifetime implicit in a partially consumed generator. `enforced-by: python/ruff D`

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
  invariants, or behavior. `enforced-by: naming/identifiers`
- Keep related classes together when they form one cohesive contract, including
  schemas, exceptions, protocols, and their input/output records. `unenforced`
- Split modules by independent responsibilities, not by class count. `enforced-by: naming/identifiers`
- Treat size limits as review prompts: document a justified limit adjustment
  rather than extracting forwarding wrappers only to reduce line counts. `unenforced`
- Do not create classes only to group static functions. `enforced-by: naming/identifiers`
- Avoid `Manager`, `Processor`, `Helper`, and similar vague class names. `enforced-by: naming/identifiers`
- Decide deliberately which attributes are public and which are internal. `unenforced`
- Use public attributes for simple data. `enforced-by: naming/identifiers`
- Use one leading underscore for internal attributes. `enforced-by: structure/private-prefix`
- Avoid double-leading underscores unless protecting a base class from subclass
  name collisions. `enforced-by: structure/private-prefix`
- Focus on the shape of data before adding behavior. `enforced-by: naming/identifiers`
- If a function coordinates work between multiple classes and no polymorphism is
  involved, keep it a function unless one class clearly owns the behavior. `enforced-by: naming/identifiers`

Good:

```python
class RuntimeBatch:
    """Tokenized prompts prepared for inference."""
```

### Initialization and named constructors

Rules:

- Keep `__init__` small. `unenforced`
- `__init__` accepts the values the class needs, not complex external
  objects that happen to contain those values. `unenforced`
- Do not couple a class constructor to database rows, ORM objects, API payloads,
  CLI namespaces, or provider SDK response objects. `unenforced`
- Use classmethod named constructors for external representations, such as
  `from_row`, `from_payload`, `from_token`, or `from_path`. `unenforced`
- Do not construct business objects with `ClassName(**external_attributes)` when
  that couples the class to an external storage or wire format. `unenforced`
- Validation of class invariants belongs in initialization. `unenforced`
- Complex loading, serialization, deserialization, and validation systems
  stay outside the business object. `unenforced`
- Derived attributes are cheap, deterministic, and based on already
  initialized fields. Prefer a named constructor when deriving them requires I/O,
  external services, or complex parsing. `unenforced`

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

- Use dataclasses for plain data records. `enforced-by: python/ruff RUF009`
- Keep dataclass fields typed. `enforced-by: python/ruff RUF009`
- Document public fields in the class docstring `Attributes:` section when the
  class is public. `enforced-by: python/ruff D`
- Do not add methods to a dataclass unless they are part of the data contract. `enforced-by: python/ruff RUF009`
- Do not use a dataclass as a disguised mutable global configuration object. `enforced-by: structure/no-singletons`
- Use `field(default_factory=...)` for mutable defaults. `enforced-by: python/ruff RUF009`
- Use `__post_init__` for simple invariant checks or cheap derived fields. `enforced-by: python/ruff RUF009`
- Prefer a named constructor over `__post_init__` when construction needs
  parsing, I/O, external objects, or multiple alternate sources. `enforced-by: python/ruff RUF009`
- If a project already uses `attrs`, apply the same principles: use factories
  for mutable defaults, validators for invariants, converters for simple input
  normalization, and named constructors for complex creation paths. `enforced-by: python/ruff RUF009`
- Do not introduce `attrs` solely to avoid writing a small dataclass or ordinary
  function. `enforced-by: python/ruff RUF009`

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

- Use properties only for cheap, straightforward, unsurprising attribute access. `unenforced`
- Do not use a property only to get and set an internal attribute. `unenforced`
- Do not hide expensive work behind attribute syntax. `unenforced`
- Do not hide side effects behind properties. `unenforced`
- Use `@property`; do not manually implement descriptors unless the power
  feature is necessary. `enforced-by: security/semgrep`
- Avoid properties for computations subclasses may need to override and extend. `unenforced`

Good:

```python
@property
def num_examples(self) -> int:
    """The number of examples."""
    return len(self.examples)
```

### Inheritance

Rules:

- Design explicitly for inheritance or avoid inheritance. `unenforced`
- Prefer composition over inheritance for code sharing. `unenforced`
- Do not subclass only to reuse methods or state. `enforced-by: naming/identifiers`
- Do not use the template method pattern as a default design. A base class that
  defines control flow and calls subclass hooks is harder to read and easier to
  break than a wrapper with explicit delegation. `unenforced`
- Do not mix three different inheritance purposes in one hierarchy: code
  sharing, interface definition, and specialization. `unenforced`
- Use protocols or small ABCs for interfaces. `enforced-by: python/basedpyright`
- Use specialization only when the subclass truly is the base class plus more
  and can be used anywhere the base class is expected. `unenforced`
- Follow the Liskov substitution principle: callers that accept the base class
  must be able to interact correctly with the subclass. `unenforced`
- Keep strict specialization hierarchies shallow and physically close together. `unenforced`
- Do not model variants as one class with a type field and many optional fields
  that only apply for some type values. `unenforced`
- Make invalid states unrepresentable. `unenforced`
- Use composition when behavior varies across more than one axis. `unenforced`
- Use a wrapper when you need one behavior plus cross-cutting behavior such as
  tracking, caching, timing, or logging. `unenforced`
- Consider `functools.singledispatch` when an operation varies by type but does
  not clearly belong to one class. `unenforced`
- Public attributes have no leading underscore. `enforced-by: structure/private-prefix`
- Internal attributes use one leading underscore. `enforced-by: structure/private-prefix`
- Double-leading underscores are only for avoiding accidental subclass name
  collisions. `enforced-by: structure/private-prefix`
- If a class is intended for subclassing, document the public API and subclass
  API separately when that distinction matters. `unenforced`

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
  contract. `unenforced`
- Decorator behavior must be unsurprising. `unenforced`
- Decorators run at definition time, which is import time. Do not let them depend
  on files, sockets, databases, network calls, or other unavailable resources. `enforced-by: structure/import-boundary`
- Decorators preserve function metadata when wrapping functions. `unenforced`
- Avoid `staticmethod`. Use a module-level function instead. `enforced-by: structure/import-boundary`
- Use `classmethod` for named constructors or class-specific routines. `unenforced`
- Use `@property` only under the property rules above. `unenforced`

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

- Custom exceptions inherit from `Exception`. `enforced-by: python/ruff N818`
- Do not inherit directly from `BaseException`. `enforced-by: python/ruff N818`
- Exception class names use CapWords. `enforced-by: python/ruff N818`
- Error exception names end with `Error`. `enforced-by: python/ruff N818`
- Exception names never repeat the module name. `enforced-by: python/ruff N818`
- Exception docstrings describe the represented condition. `enforced-by: python/ruff D`

Good:

```python
class InvalidVariantError(Exception):
    """The requested model variant is not supported."""
```
