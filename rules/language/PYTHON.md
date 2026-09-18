---
layer: language
preset: python
title: Python
---

# Python

The Python rules span five files: this one (modules, imports, interfaces, docstrings, entry points),
Typing, Design (functions and classes), Flow (control flow, errors, logging, resources), and
Packaging (installs and dependencies).

## Core Python philosophy

Rules:

- Write readable Python before clever Python. `unenforced`
- Prefer explicit data flow, clear names, and small functions. `unenforced`
- Keep code import-stable. Importing a module must not load models, initialize
  engines, touch external services, start background work, parse CLI arguments, or mutate
  runtime state. `enforced-by: structure/import-boundary`
- Prefer project-specific rules over generic style guides when they conflict. `unenforced`
- Prefer consistency with the surrounding module when a source guide allows more
  than one style. `unenforced`
- Do not make style-only churn outside the requested scope. `unenforced`
- Do not preserve obsolete Python APIs, wrappers, re-exports, or alternate code
  paths. Replace it completely. `enforced-by: python/vulture`
- Make public behavior clear through names, type annotations, docstrings, and
  tests. `enforced-by: python/ruff D`
- Use exceptions for exceptional conditions, not for ordinary branch logic. `enforced-by: python/ruff TRY`
- Use built-in language features directly when they express the operation
  clearly. `enforced-by: python/ruff TRY`

Good Python is easy to scan:

```python
"""Yield request text from chat messages."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class PromptMessage:
    """One request message."""

    content: str

def iter_message_text(messages: Iterable[PromptMessage]) -> Iterable[str]:
    """Yield text content from request messages."""
    for message in messages:
        yield message.content

__all__ = [
    "PromptMessage",
    "iter_message_text",
]
```

## Runtime, encoding, and files

Rules:

- Use the syntax of the project's declared Python version. The version is stated once, in the
  runtime pin, and never repeated in prose. `unenforced`
- Store source files as UTF-8. `enforced-by: naming/identifiers`
- Do not add an encoding declaration unless a tool or runtime requires it. `enforced-by: naming/identifiers`
- Use LF line endings. `enforced-by: naming/identifiers`
- Keep identifiers ASCII-only. `enforced-by: naming/identifiers`
- Use English words for identifiers, comments, and docstrings unless an external
  identifier must keep another language or spelling. `enforced-by: python/ruff D`
- Use non-ASCII characters sparingly in string data. `enforced-by: naming/identifiers`
- Do not use byte-order marks. `enforced-by: naming/identifiers`
- Python filenames must use `.py`. `enforced-by: naming/identifiers`
- Python filenames must be snake_case, except `__init__.py` and `__main__.py`. `enforced-by: naming/identifiers`
- Python filenames must not contain dashes. `enforced-by: naming/identifiers`
- Keep modules importable by pydoc, tests, linting tools, and type checkers. `enforced-by: naming/identifiers`

Good:

```text
model_config.py
modeling.py
__main__.py
```

## Environment and configuration

Rules:

- Treat environment variables as external text input. `enforced-by: structure/env-access-owner`
- Read environment variables in one configuration owner module. `os.environ` and `os.getenv`
  appear nowhere else. `enforced-by: structure/env-access-owner`
- Parse and validate environment-derived values once before passing them inward. `unenforced`
- Store secrets in environment variables or a secret manager, never in source
  code, docs examples, tests, or checked-in config. `enforced-by: structure/env-access-owner`
- Do not use a real-looking default for a secret. Missing required secrets
  fail at startup or command initialization. `enforced-by: secrets/gitleaks`
- Do not make importable modules depend on an active shell, virtual
  environment, current working directory, or globally installed package. `enforced-by: integrity/dependency-ownership`
- Use project configuration, editable installs, `python -m`, or the configured
  environment to resolve imports. `enforced-by: integrity/dependency-ownership`
- Do not commit virtual environment directories or generated package caches. `enforced-by: integrity/dependency-ownership`

Good:

```python
@dataclass(frozen=True)
class AppConfig:
    """Runtime configuration loaded from the environment."""

    max_items: int

def load_config(environ: Mapping[str, str]) -> AppConfig:
    """Load runtime configuration from environment variables."""
    raw_max_items = environ.get("MAX_ITEMS", "100")
    return AppConfig(max_items=int(raw_max_items))
```

## Module structure

Order module contents this way:

1. Module docstring. `enforced-by: python/ruff D100`
2. `from __future__ import annotations`, when used. `enforced-by: python/basedpyright`
3. Other module dunders, except `__all__`. `enforced-by: structure/private-prefix`
4. Imports. `unenforced`
5. Module constants. `enforced-by: structure/no-singletons`
6. Type aliases. `enforced-by: python/basedpyright`
7. Dataclasses and classes, internal ones first. `enforced-by: structure/private-before-public`
8. Functions, internal ones first. `enforced-by: structure/private-before-public`
9. `if __name__ == "__main__":` guard, when the module is executable. `enforced-by: structure/shell-embeds`
10. `__all__` at the bottom. `enforced-by: structure/private-prefix`

Rules:

- Every runtime module has a module docstring that describes its present
  purpose. `enforced-by: python/ruff D100`
- Keep top-level code limited to declarations, constants, imports, and cheap
  initialization. `enforced-by: structure/import-boundary`
- Do not perform I/O, network calls, quantization, model loading, CLI parsing, or
  long computations at import time. `enforced-by: structure/import-boundary`
- Do not mutate global runtime state at import time except for declared
  constants and deliberate local configuration. `enforced-by: structure/import-boundary`
- Keep `__all__` explicit for modules with a public API. `enforced-by: structure/private-prefix`
- Use `__all__ = []` when a module intentionally exports no public names. `enforced-by: structure/private-prefix`
- Every top-level name not listed in `__all__` starts with one underscore. The list and the
  prefix cannot disagree. `enforced-by: structure/private-prefix`
- Every internal definition sits above the first public definition. Python resolves names at call
  time, so the order has no runtime meaning. `enforced-by: structure/private-prefix`
- The order is fixed so a reader meets the helpers before the code that uses them, the same order
  the TypeScript and Bash rules require. `enforced-by: structure/private-prefix`

Good:

```python
"""Configuration constants for runtime settings."""

from __future__ import annotations

from pathlib import Path

MODELS_DIR = Path("/models")
DEFAULT_ENGINE = "trt"

def _model_dir_name(name: str) -> str:
    return name.strip().lower()

def resolve_model_dir(name: str) -> Path:
    """Return the model directory for a model name."""
    return MODELS_DIR / _model_dir_name(name)

__all__ = [
    "DEFAULT_ENGINE",
    "MODELS_DIR",
    "resolve_model_dir",
]
```

## Imports

Rules:

- Put imports at the top of the file, after the module docstring, and future
  imports. `enforced-by: python/ruff D100`
- Group imports in PEP 8 sections separated by one blank line: `__future__`, standard library,
  third-party, first-party, local. Sort alphabetically within a section, `import x` before
  `from x import y`, names inside a grouped import sorted alphabetically. `enforced-by: structure/import-layout`
- A project that prefers one flat block sorted by rendered line length declares it with
  `[tools.ruff] import_sort = "length"`; the formatter then owns that order. `enforced-by: integrity/dependency-ownership`
- Apply the same ordering inside a top-level bare `if TYPE_CHECKING:` body. `enforced-by: structure/import-layout`
- Put a blank line after the last import. `enforced-by: structure/import-layout`
- Use one import per line for ordinary imports. `enforced-by: structure/import-layout`
- Import typing and `collections.abc` symbols directly. `enforced-by: structure/import-layout`
- Use absolute imports for cross-package repository imports. `enforced-by: structure/import-layout`
- Use explicit relative imports for sibling modules inside the same package when
  surrounding code already does that. `enforced-by: structure/import-layout`
- Never use implicit relative imports. `enforced-by: structure/import-layout`
- Never use wildcard imports. `enforced-by: structure/import-layout`
- Never import inside function, method, or class bodies in runtime code. `enforced-by: structure/import-layout`
- Never use dynamic imports through `importlib.import_module`, `__import__`, or
  `builtins.__import__` in runtime code. `enforced-by: structure/import-layout`
- Do not rely on the main script directory being present on `sys.path`. `enforced-by: integrity/dependency-ownership`
- Avoid circular imports by moving shared data or contracts into a lower-level
  owner. `enforced-by: structure/import-layout`

Good:

```python
from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from pathlib import Path

import torch
from transformers import AutoTokenizer

from src.config.model.selection import MODEL
from src.runtime.config import ModelSettings

from .runtime import RuntimeConfig
```

Direct symbol imports are acceptable for public classes, functions, constants,
and typing symbols when they make the call site clearer:

```python
from pathlib import Path
from typing import Literal
from dataclasses import dataclass
from src.runtime.config import ModelSettings
```

Use module imports when the module prefix makes ownership clearer:

```python
import random
import logging

logger = logging.getLogger(__name__)
rng = random.Random(seed)  # noqa: S311
```

Use aliases only when:

- two imported modules have the same final name; `unenforced`
- an imported module conflicts with a local top-level name; `unenforced`
- the original module name is inconveniently long; `unenforced`
- the alias is a standard abbreviation, such as `np` for NumPy; `enforced-by: python/ruff E711`
- the alias disambiguates a generic module name. `unenforced`

## Public and internal interfaces

Rules:

- Public names are names intended for callers outside the module. `enforced-by: structure/private-prefix`
- Internal names use one leading underscore. `enforced-by: structure/private-prefix`
- Do not use double-leading underscores unless avoiding subclass collisions in a
  class designed for inheritance. `enforced-by: structure/private-prefix`
- Do not invent double-leading and double-trailing dunder names. `enforced-by: structure/private-prefix`
- Use `__all__` to declare public module exports. `enforced-by: structure/private-prefix`
- Imported names are implementation details unless explicitly exported through
  `__all__` or documented as module API. `enforced-by: structure/private-prefix`
- Do not rely on indirect access to names imported by another module. `unenforced`
- Public attributes have no leading underscore. `enforced-by: structure/private-prefix`
- Internal modules, functions, constants, and attributes have one leading
  underscore. `enforced-by: structure/private-prefix`
- A module-level function, class, constant or type alias that is not in `__all__` starts with
  one underscore, and every underscored definition comes before the first public one. `enforced-by: structure/import-boundary`

Good:

```python
_DEFAULT_TIMEOUT_SECONDS = 30

def _normalize_quantization(value: str) -> str:
    return value.strip().lower()

def build_model_settings(model: str, quantization: str) -> ModelSettings:
    """Build model settings for one runtime."""
    return ModelSettings(model=model, quantization=_normalize_quantization(quantization))

__all__ = [
    "build_model_settings",
]
```

## Formatting

The formatter is the source of truth for mechanical formatting. It owns indentation (4 spaces),
line length, blank lines, whitespace, trailing commas, parentheses, and string quotes (double).

Rules:

- Do not hand-align code in ways the formatter will undo. `enforced-by: python/ruff-format`
- Do not use semicolons. `enforced-by: python/ruff-format`
- Do not put multiple statements on one line. `enforced-by: python/ruff-format`
- Keep formatting consistent with the surrounding file when the formatter allows more than one
  readable option. `enforced-by: python/ruff-format`

## Comments and docstrings

Rules:

- Describe present behavior only. `unenforced`
- Do not include change history. `unenforced`
- Do not mention removed, replaced, renamed, or previous code. `unenforced`
- Do not reference specific file paths unless the reference is essential and
  stable. `unenforced`
- Keep comments and docstrings accurate when behavior changes. `enforced-by: python/ruff D`
- Use clear English. `unenforced`
- Use complete sentences for block comments and docstrings. `enforced-by: integrity/dependency-ownership`
- Keep punctuation, spelling, and grammar clean. `unenforced`

### Comments

Rules:

- Use comments to explain intent, invariants, edge cases, and non-obvious
  choices. `enforced-by: python/ruff ERA001`
- Do not narrate obvious code. `enforced-by: python/ruff ERA001`
- Block comments apply to the code that follows and use `#` plus one space on each line. `enforced-by: integrity/dependency-ownership`
- Inline comments are separated from code by at least two spaces and start with
  `#` plus one space. `enforced-by: python/ruff ERA001`
- Use inline comments sparingly. `enforced-by: python/ruff ERA001`
- Keep comments up to date when code changes. `enforced-by: python/ruff ERA001`

Good:

```python
# Longformer uses the first token for global attention in classification.
global_attention_mask[:, 0] = 1
```

When suppressing a linter warning, keep the suppression narrow and explain it
when the symbolic name is not enough:

```python
rng = random.Random(seed)  # noqa: S311
```

### Docstrings

Rules:

- Use triple double quotes for all docstrings. `enforced-by: python/ruff D`
- Write docstrings for public modules, functions, classes, and methods. `enforced-by: python/ruff D`
- Write docstrings for nontrivial private functions and methods. `enforced-by: structure/private-prefix`
- Do not write noisy docstrings for obvious private helpers. `enforced-by: structure/private-prefix`
- One-line docstrings stay on one line and end with punctuation. `enforced-by: python/ruff D`
- Multiline docstrings start with a one-line summary, then a blank line, then
  details. `enforced-by: python/ruff D`
- Put the closing triple quotes of a multiline docstring on their own line. `enforced-by: python/ruff D`
- Do not restate the signature in a docstring. `enforced-by: python/ruff D`
- Document arguments, return values, yielded values, side effects, and raised
  exceptions when they are part of the interface. `unenforced`
- Do not document exceptions raised only when callers violate the documented
  contract. `unenforced`
- Summary lines are imperative: `Return the total token budget.`, not `Returns the total token budget.` `enforced-by: python/ruff D`

Good one-line docstring:

```python
def build_token_budget(prompt_tokens: int, output_tokens: int) -> int:
    """Return the total token budget."""
    return prompt_tokens + output_tokens
```

Good multiline docstring:

```python
def fetch_rows(keys: Sequence[str]) -> Mapping[str, tuple[str, ...]]:
    """Fetch rows for the requested keys.

    Retrieves one row for each key that exists in the backing table.

    Args:
        keys: Keys to fetch.

    Returns:
        A mapping from key to row values.

    Raises:
        OSError: The backing table could not be read.
    """
```

### Module docstrings

Rules:

- Runtime modules start with a docstring describing the module's purpose. `enforced-by: python/ruff D`
- A module docstring may include a short usage example when it helps callers. `enforced-by: python/ruff D100`
- Test modules do not need a module docstring unless they need unusual setup,
  environment, or update instructions. `enforced-by: python/ruff D100`
- Do not write a test module docstring that only repeats the file name or module
  name. `enforced-by: python/ruff D100`

Good:

```python
"""Runtime settings assembly for the inference server."""
```

### Function and method docstrings

Rules:

- Public functions and methods require docstrings. `enforced-by: python/ruff D`
- Nontrivial private helpers require docstrings. `enforced-by: structure/private-prefix`
- Functions with non-obvious logic require docstrings. `enforced-by: python/ruff D`
- Functions that mutate an argument must say so. `unenforced`
- Generator functions use `Yields:` instead of `Returns:`. `enforced-by: python/ruff D`
- `Returns:` may be omitted when the one-line summary already fully describes
  the returned value. `enforced-by: python/ruff D`
- Do not document `None` returns unless it clarifies control flow. `unenforced`
- Use `Args:`, `Returns:`, `Yields:`, and `Raises:` sections when needed. `enforced-by: python/ruff D`
- Keep section indentation consistent within a file. `unenforced`

Good:

```python
def build_engine_settings(
    inference_engine: str | None,
    trt_engine_dir: str,
    default_max_batched_tokens: int,
) -> EngineSettings:
    """Build inference engine settings from validated inputs.

    Args:
        inference_engine: Runtime backend name.
        trt_engine_dir: TensorRT engine directory.
        default_max_batched_tokens: vLLM token batch limit.

    Returns:
        Resolved engine settings.
    """
```

### Class docstrings

Rules:

- Public classes require docstrings. `enforced-by: python/ruff D`
- A class docstring starts with a one-line summary describing what an instance
  represents. `enforced-by: python/ruff D`
- Public attributes, excluding properties, are documented in an `Attributes:`
  section. `enforced-by: python/ruff D`
- Exception class docstrings describe the condition represented by the
  exception, not the raising site. `enforced-by: python/ruff D`
- Do not write `Class that...` as the summary. `enforced-by: python/ruff D`

Good:

```python
@dataclass
class RuntimePrompt:
    """Single runtime prompt example.

    Attributes:
        prompt: Normalized prompt text.
        expected_status: Expected response status.
        group: Group identifier for related prompts.
    """

    prompt: str
    expected_status: str
    group: str
```

Good exception docstring:

```python
class MissingModelError(Exception):
    """The requested model artifact is unavailable."""
```

### Property docstrings

Rules:

- Property docstrings describe the attribute, not the method action. `enforced-by: python/ruff D`
- Use attribute-style wording. `unenforced`
- Do not write `Returns...` for a property unless the surrounding file already
  uses that style. `enforced-by: python/ruff-format`

Good:

```python
@property
def num_labels(self) -> int:
    """The number of supported runtime labels."""
    return len(self.labels)
```

### Override docstrings

Rules:

- An overridden method may omit a docstring when it is decorated with
  `@override` and does not materially change the base contract. `enforced-by: python/ruff D`
- Add a docstring when an override changes behavior, side effects, constraints,
  or return semantics. `enforced-by: python/ruff D`
- Use `typing.override` when available in the target runtime. Use
  `typing_extensions.override` when needed. `enforced-by: python/ruff D`

Good:

```python
from typing_extensions import override

class Child(Parent):
    @override
    def build(self) -> Result:
        return super().build()
```

### `TODO` comments

Rules:

- Use `TODO` comments only for temporary, tracked work. `enforced-by: python/ruff ERA001`
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`. The owner is an issue link or an
  expiry date, never a person, or team. `enforced-by: python/ruff TD`
- Do not add TODOs for vague future improvements. `enforced-by: python/ruff TD`
- An expired date or a closed issue makes the `TODO` a finding. `enforced-by: python/ruff TD`

Good:

```python
# TODO(https://example.com/issues/123): Remove this branch when all exports use JSONL.
```

## Constants, globals, and mutable state

Rules:

- Module constants are allowed and encouraged. `enforced-by: structure/no-singletons`
- Constants use uppercase names with underscores. `enforced-by: structure/private-prefix`
- Internal constants use one leading underscore. `enforced-by: structure/private-prefix`
- Avoid mutable global state. `enforced-by: structure/no-singletons`
- Do not use lazy singleton state. `enforced-by: structure/no-singletons`
- Do not create module-level `STATE`, `_STATE`, `INSTANCE`, `_INSTANCE`, or
  `_instance` holders. `enforced-by: structure/import-boundary`
- Do not expose mutable globals directly as public API. `enforced-by: structure/no-singletons`
- If mutable global state is genuinely required, keep it internal and document
  the design reason. `enforced-by: structure/no-singletons`
- Do not mutate module globals as a hidden side effect of ordinary function
  calls. `enforced-by: structure/no-singletons`

Good:

```python
DEFAULT_MODEL_NAME = "answerdotai/ModernBERT-base"
_MAX_RETRIES = 3
```

Prefer passing state explicitly:

```python
def build_client(config: ClientConfig) -> Client:
    return Client(config)
```

## Main programs and Top-Level code

Rules:

- Executable modules put main behavior in a `main()` function. `enforced-by: structure/shell-embeds`
- Use `if __name__ == "__main__":` before executing program behavior. `enforced-by: structure/shell-embeds`
- Prefer `raise SystemExit(main())` when `main()` returns an exit code. `enforced-by: structure/shell-embeds`
- Do not parse CLI arguments at import time. `enforced-by: structure/import-boundary`
- Do not run quantization, model loading, tests, network calls, or file
  mutations at import time. `enforced-by: structure/import-boundary`
- Use `python -m package.module` for repository Python entrypoints. `enforced-by: structure/shell-embeds`
- Shell scripts must call Python modules, not inline Python snippets. `enforced-by: structure/shell-embeds`
- Files that are not intended to execute directly do not need a shebang. `enforced-by: structure/shell-embeds`
- Directly executable Python files may use `#!/usr/bin/env python3` when a
  shebang is needed. `enforced-by: structure/shell-embeds`

Good:

```python
def main() -> int:
    """Run the command."""
    ...
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

## Power features

Avoid power features unless the project already has a clear local pattern and `enforced-by: security/semgrep`
the feature is necessary.

Avoid:

- custom metaclasses; `enforced-by: security/semgrep`
- bytecode manipulation; `enforced-by: security/semgrep`
- dynamic inheritance; `enforced-by: security/semgrep`
- object reparenting; `enforced-by: security/semgrep`
- import hooks and import hacks; `enforced-by: security/semgrep`
- runtime monkeypatching; `enforced-by: security/semgrep`
- reflection-heavy designs; `enforced-by: security/semgrep`
- modifying interpreter internals; `enforced-by: security/semgrep`
- `__del__` cleanup logic; `enforced-by: security/semgrep`
- manual descriptor implementations; `enforced-by: security/semgrep`
- dynamic code generation. `enforced-by: security/semgrep`

Allowed standard-library uses include `dataclasses`, `enum`, and `abc` when they
fit the problem.

Rules:

- Do not use a power feature to make code shorter. `enforced-by: security/semgrep`
- Do not use a power feature to hide a dependency cycle or ownership problem. `enforced-by: security/semgrep`
- Prefer ordinary functions, dataclasses, explicit imports, and explicit data
  structures. `enforced-by: python/ruff RUF009`

## Threading and concurrency

Rules:

- Do not rely on atomicity of built-in types. `enforced-by: python/ruff ASYNC`
- Do not rely on atomic variable assignment for synchronization. `enforced-by: python/ruff ASYNC`
- Use `queue.Queue` for thread communication when appropriate. `enforced-by: python/ruff ASYNC`
- Use `threading` locks, conditions, or higher-level primitives for shared
  state. `enforced-by: integrity/dependency-ownership`
- Prefer `threading.Condition` over low-level polling loops. `enforced-by: python/ruff ASYNC`
- Keep shared mutable state small and explicit. `enforced-by: python/ruff ASYNC`
- Document concurrency, cancellation, and isolation behavior when present. `enforced-by: python/ruff ASYNC`

## Tests

Rules:

- Test behavior, not implementation details. `unenforced`
- Use pytest-style `assert` in tests. `enforced-by: python/ruff S101`
- Keep tests focused on the behavior under change. `unenforced`
- Do not add module docstrings to test files unless they explain unusual setup,
  environment requirements, or update commands. `enforced-by: integrity/dependency-ownership`
- Do not assert hardcoded configuration values that can change freely. `unenforced`
- Use mocks only at external boundaries. `unenforced`
- Do not test that mocks return the values assigned inside the test. `unenforced`
- Cover meaningful edge cases, failure paths, and state transitions. `unenforced`

Good:

```python
def test_parse_prompt_rejects_unexpected_entry() -> None:
    with pytest.raises(TypeError, match="Unexpected prompt entry"):
        parse_prompt(value=object())
```

## Review checklist

Before `gspot check`, read the change against these questions:

- Does the code follow local project rules over generic style preferences? `unenforced`
- Are imports top-level, grouped, sorted, and free of cycles? `unenforced`
- Is the module import-stable, with no import-time work? `enforced-by: structure/import-boundary`
- Are public APIs typed and documented? `unenforced`
- Do argument types accept the broadest useful protocol or abstract collection? `unenforced`
- Do concrete implementations return concrete types? `unenforced`
- Is `Any` avoided where `object`, a protocol, or a type variable expresses `enforced-by: python/basedpyright`
- Are names consistent with [`NAMING.md`](../general/code/NAMING.md)? `unenforced`
- Are functions small, focused, and under the local length limit? `unenforced`
- Are defaults immutable or initialized inside the function? `unenforced`
- Are None checks explicit? `unenforced`
- Are constructors free of external row, payload, SDK, or CLI object coupling? `unenforced`
- Is subclassing used only for interfaces or true specialization, not code `unenforced`
- Are exceptions specific, with narrow `try` blocks? `enforced-by: integrity/dependency-ownership`
- Are resources managed with `with` or documented ownership? `unenforced`
- Are logging calls using literal pattern strings and argument parameters? `unenforced`
- Is logging configured only at the application boundary? `unenforced`
- Are error messages precise, actionable, and free of internal details? `unenforced`
- Are environment variables read, parsed, and validated at a boundary instead `enforced-by: structure/env-access-owner`
- When changing deployment install commands, are pip requirements pinned, `enforced-by: integrity/dependency-ownership`
- Are comments present where behavior is non-obvious and absent where they only `enforced-by: python/ruff ERA001`
- Is `__all__` explicit and at the bottom when public exports exist? `enforced-by: structure/private-prefix`
- Are package boundaries and import-linter contracts respected? `unenforced`
- Is importable code under `src/` without `sys.path` mutation? `enforced-by: integrity/dependency-ownership`
- For FastAPI code, are path operations thin and grouped behind routers? `unenforced`
- For FastAPI code, are parameter defaults, `Annotated` metadata, and `enforced-by: python/basedpyright`
- For FastAPI code, are route declarations ordered so fixed paths are not `unenforced`
- For FastAPI code, are request and response schemas using Pydantic v2 APIs and `unenforced`
- For FastAPI code, are `Field` constraints, schema metadata, and examples `unenforced`
- For FastAPI code, do nested models use precise typed fields instead of `unenforced`
- For FastAPI code, are special boundary types such as `UUID`, `datetime`, `unenforced`
- For FastAPI code, are headers and cookies declared with `Header()` and `unenforced`
- For FastAPI code, do response models filter private fields through dedicated `enforced-by: structure/private-prefix`
- For FastAPI code, are success status codes declared on decorators, error `unenforced`
- For FastAPI code, are custom exception handlers registered at the app boundary `unenforced`
- For FastAPI code, are forms and files declared with `Form()`, `File()`, and `unenforced`
- For FastAPI code, do file uploads use `UploadFile` unless the file is small `unenforced`
- For FastAPI code, are replacement and partial-update routes using clear `unenforced`
- For FastAPI code, are OpenAPI, Swagger UI, and ReDoc disabled by default and `unenforced`
- For FastAPI code, is blocking I/O kept out of `async def` path operations? `enforced-by: integrity/dependency-ownership`
- For FastAPI code, are dependencies placed at the narrowest correct boundary:
- For FastAPI code, are secrets externalized, credentials errors generic, and `enforced-by: secrets/gitleaks`
- For FastAPI code, are background tasks, middleware, and streaming endpoints `unenforced`
- Did you avoid tests, linting, and formatting commands unless requested? `unenforced`

## Source decisions

These rules adapt PEP 8, PEP 257, and the Google Python Style Guide into one standard. Where they
disagree, the decision is:

| Topic                    | Decision                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Style authority          | These rules and the configured tools win over the source guides.                                                                                                                                                                                            |
| Line length              | The formatter's configured line length, not PEP 8's 79 or Google's 80.                                                                                                                                                                                      |
| Formatter and linters    | Ruff format, Ruff lint, basedpyright, import-linter, and the structure engine. Pylint guidance from Google maps to these tools.                                                                                                                             |
| Runtime                  | The project's declared Python version, stated once in the runtime pin.                                                                                                                                                                                      |
| Future imports           | Prefer `from __future__ import annotations`.                                                                                                                                                                                                                |
| Quotes                   | Double quotes; docstrings always triple double quotes.                                                                                                                                                                                                      |
| Imports                  | Absolute imports across packages; explicit relative sibling imports inside a package when that is the local pattern; direct imports of public symbols and of typing and `collections.abc` names.                                                            |
| `__all__`                | At the bottom of the module, overriding PEP 8's dunder placement for `__all__` only. Other dunders such as `__version__` sit after the module docstring and future imports.                                                                                 |
| License boilerplate      | None unless the project defines the exact text.                                                                                                                                                                                                             |
| Function and file length | The configured limits; barrel `__init__.py` files are exempt from the file limit.                                                                                                                                                                           |
| Typing                   | Every function annotated; modern union syntax, built-in generics, `type` statements or `TypeAlias` for real aliases, `Annotated` for metadata, `object` for any value, protocols for structural interfaces; abstract input types and concrete return types. |
| Logging                  | `logging.getLogger(__name__)` in modules; entrypoints configure handlers; libraries add only `NullHandler`.                                                                                                                                                 |
| Project layout           | Importable code under `src/`; no `sys.path` patches.                                                                                                                                                                                                        |
| Inheritance              | Composition for code sharing, protocols for interfaces, subclassing only for true specialization.                                                                                                                                                           |
| FastAPI                  | The FastAPI rules apply only to FastAPI applications and never override these rules.                                                                                                                                                                        |
| Package installs         | Pinned, hashed, binary-only requirements for deployments; no direct setuptools commands.                                                                                                                                                                    |

When editing an existing file, follow the surrounding style where the source guides allow a choice.
When creating new code, use the decisions in this table.

## Tooling authority

- Treat a lint failure as a policy failure. `unenforced`
- Do not add per-file ignores, inline ignores, or broad config exceptions. The exceptions are a
  tooling change the user asked for, or an unavoidable violation, and each carries a reason.
  `unenforced`
- Do not copy an existing per-file ignore into new files. `unenforced`
- Do not broaden an existing exception to make unrelated code pass. `unenforced`
- Do not disable a rule when a clear code change can satisfy it. `unenforced`
