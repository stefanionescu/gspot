---
layer: language
configuration: python
title: Python
---

# Python

The Python rules span five files: this one (modules, imports, interfaces, docstrings, entry points),
Typing, Design (functions and classes), Flow (control flow, errors, logging, resources), and
Packaging (installs and dependencies).

## Core Python philosophy

Rules:

- Write readable Python before clever Python.
- Prefer explicit data flow, clear names, and small functions.
- Keep code import-stable. Importing a module must not load models, initialize
  engines, touch external services, start background work, parse CLI arguments, or mutate
  runtime state.
- Prefer project-specific rules over generic style guides when they conflict.
- Prefer consistency with the surrounding module when a source guide allows more
  than one style.
- Do not make style-only churn outside the requested scope.
- Do not preserve obsolete Python APIs, wrappers, re-exports, or alternate code
  paths. Replace it completely.
- Make public behavior clear through names, type annotations, docstrings, and
  tests.
- Use exceptions for exceptional conditions, not for ordinary branch logic.
- Use built-in language features directly when they express the operation
  clearly.

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
  runtime pin, and never repeated in prose.
- Store source files as UTF-8.
- Do not add an encoding declaration unless a tool or runtime requires it.
- Use LF line endings.
- Keep identifiers ASCII-only.
- Use English words for identifiers, comments, and docstrings unless an external
  identifier must keep another language or spelling.
- Use non-ASCII characters sparingly in string data.
- Do not use byte-order marks.
- Python filenames must use `.py`.
- Python filenames must be snake_case, except `__init__.py` and `__main__.py`.
- Python filenames must not contain dashes.
- Keep modules importable by pydoc, tests, linting tools, and type checkers.

Good:

```text
model_config.py
modeling.py
__main__.py
```

## Environment and configuration

Rules:

- Treat environment variables as external text input.
- Read environment variables in one configuration owner module. `os.environ` and `os.getenv`
  appear nowhere else.
- Parse and validate environment-derived values once before passing them inward.
- Store secrets in environment variables or a secret manager, never in source
  code, docs examples, tests, or checked-in config.
- Do not use a real-looking default for a secret. Missing required secrets
  fail at startup or command initialization.
- Do not make importable modules depend on an active shell, virtual
  environment, current working directory, or globally installed package.
- Use project configuration, editable installs, `python -m`, or the configured
  environment to resolve imports.
- Do not commit virtual environment directories or generated package caches.

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

1. Module docstring.
2. `from __future__ import annotations`, when used.
3. Other module dunders, except `__all__`.
4. Imports.
5. Module constants.
6. Type aliases.
7. Dataclasses and classes, internal ones first.
8. Functions, internal ones first.
9. `if __name__ == "__main__":` guard, when the module is executable.
10. `__all__` at the bottom.

Rules:

- Every runtime module has a module docstring that describes its present
  purpose.
- Keep top-level code limited to declarations, constants, imports, and cheap
  initialization.
- Do not perform I/O, network calls, quantization, model loading, CLI parsing, or
  long computations at import time.
- Do not mutate global runtime state at import time except for declared
  constants and deliberate local configuration.
- Keep `__all__` explicit for modules with a public API.
- Use `__all__ = []` when a module intentionally exports no public names.
- Every top-level name not listed in `__all__` starts with one underscore. The list and the
  prefix cannot disagree.
- Every internal definition sits above the first public definition. Python resolves names at call
  time, so the order has no runtime meaning.
- The order is fixed so a reader meets the helpers before the code that uses them, the same order
  the TypeScript and Bash rules require.

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
  imports.
- Group imports in PEP 8 sections separated by one blank line: `__future__`, standard library,
  third-party, first-party, local. Sort alphabetically within a section, `import x` before
  `from x import y`, names inside a grouped import sorted alphabetically.
- A project that prefers one flat block sorted by rendered line length declares that choice in
  its linter configuration; the formatter then owns that order.
- Apply the same ordering inside a top-level bare `if TYPE_CHECKING:` body.
- Put a blank line after the last import.
- Use one import per line for ordinary imports.
- Import typing and `collections.abc` symbols directly.
- Use absolute imports for cross-package repository imports.
- Use explicit relative imports for sibling modules inside the same package when
  surrounding code already does that.
- Never use implicit relative imports.
- Never use wildcard imports.
- Never import inside function, method, or class bodies in runtime code.
- Never use dynamic imports through `importlib.import_module`, `__import__`, or
  `builtins.__import__` in runtime code.
- Do not rely on the main script directory being present on `sys.path`.
- Avoid circular imports by moving shared data or contracts into a lower-level
  owner.

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

- two imported modules have the same final name;
- an imported module conflicts with a local top-level name;
- the original module name is inconveniently long;
- the alias is a standard abbreviation, such as `np` for NumPy;
- the alias disambiguates a generic module name.

## Public and internal interfaces

Rules:

- Public names are names intended for callers outside the module.
- Internal names use one leading underscore.
- Do not use double-leading underscores unless avoiding subclass collisions in a
  class designed for inheritance.
- Do not invent double-leading and double-trailing dunder names.
- Use `__all__` to declare public module exports.
- Imported names are implementation details unless explicitly exported through
  `__all__` or documented as module API.
- Do not rely on indirect access to names imported by another module.
- Public attributes have no leading underscore.
- Internal modules, functions, constants, and attributes have one leading
  underscore.
- A module-level function, class, constant or type alias that is not in `__all__` starts with
  one underscore, and every underscored definition comes before the first public one.

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

- Do not hand-align code in ways the formatter will undo.
- Do not use semicolons.
- Do not put multiple statements on one line.
- Keep formatting consistent with the surrounding file when the formatter allows more than one
  readable option.

## Comments and docstrings

Rules:

- Describe present behavior only.
- Do not include change history.
- Do not mention removed, replaced, renamed, or previous code.
- Do not reference specific file paths unless the reference is essential and
  stable.
- Keep comments and docstrings accurate when behavior changes.
- Use clear English.
- Use complete sentences for block comments and docstrings.
- Keep punctuation, spelling, and grammar clean.

### Comments

Rules:

- Use comments to explain intent, invariants, edge cases, and non-obvious
  choices.
- Do not narrate obvious code.
- Block comments apply to the code that follows and use `#` plus one space on each line.
- Inline comments are separated from code by at least two spaces and start with
  `#` plus one space.
- Use inline comments sparingly.
- Keep comments up to date when code changes.

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

- Use triple double quotes for all docstrings.
- Write docstrings for public modules, functions, classes, and methods.
- Write docstrings for nontrivial private functions and methods.
- Do not write noisy docstrings for obvious private helpers.
- One-line docstrings stay on one line and end with punctuation.
- Multiline docstrings start with a one-line summary, then a blank line, then
  details.
- Put the closing triple quotes of a multiline docstring on their own line.
- Do not restate the signature in a docstring.
- Document arguments, return values, yielded values, side effects, and raised
  exceptions when they are part of the interface.
- Do not document exceptions raised only when callers violate the documented
  contract.
- Summary lines are imperative: `Return the total token budget.`, not `Returns the total token budget.`

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

- Runtime modules start with a docstring describing the module's purpose.
- A module docstring may include a short usage example when it helps callers.
- Test modules do not need a module docstring unless they need unusual setup,
  environment, or update instructions.
- Do not write a test module docstring that only repeats the file name or module
  name.

Good:

```python
"""Runtime settings assembly for the inference server."""
```

### Function and method docstrings

Rules:

- Public functions and methods require docstrings.
- Nontrivial private helpers require docstrings.
- Functions with non-obvious logic require docstrings.
- Functions that mutate an argument must say so.
- Generator functions use `Yields:` instead of `Returns:`.
- `Returns:` may be omitted when the one-line summary already fully describes
  the returned value.
- Do not document `None` returns unless it clarifies control flow.
- Use `Args:`, `Returns:`, `Yields:`, and `Raises:` sections when needed.
- Keep section indentation consistent within a file.

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

- Public classes require docstrings.
- A class docstring starts with a one-line summary describing what an instance
  represents.
- Public attributes, excluding properties, are documented in an `Attributes:`
  section.
- Exception class docstrings describe the condition represented by the
  exception, not the raising site.
- Do not write `Class that...` as the summary.

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

- Property docstrings describe the attribute, not the method action.
- Use attribute-style wording.
- Do not write `Returns...` for a property unless the surrounding file already
  uses that style.

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
  `@override` and does not materially change the base contract.
- Add a docstring when an override changes behavior, side effects, constraints,
  or return semantics.
- Use `typing.override` when available in the target runtime. Use
  `typing_extensions.override` when needed.

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

- Use `TODO` comments only for temporary, tracked work.
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`. The owner is an issue link or an
  expiry date, never a person, or team.
- Do not add TODOs for vague future improvements.
- An expired date or a closed issue makes the `TODO` a finding.

Good:

```python
# TODO(https://example.com/issues/123): Remove this branch when all exports use JSONL.
```

## Constants, globals, and mutable state

Rules:

- Module constants are allowed and encouraged.
- Constants use uppercase names with underscores.
- Internal constants use one leading underscore.
- Avoid mutable global state.
- Do not use lazy singleton state.
- Do not create module-level `STATE`, `_STATE`, `INSTANCE`, `_INSTANCE`, or
  `_instance` holders.
- Do not expose mutable globals directly as public API.
- If mutable global state is genuinely required, keep it internal and document
  the design reason.
- Do not mutate module globals as a hidden side effect of ordinary function
  calls.

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

- Executable modules put main behavior in a `main()` function.
- Use `if __name__ == "__main__":` before executing program behavior.
- Prefer `raise SystemExit(main())` when `main()` returns an exit code.
- Do not parse CLI arguments at import time.
- Do not run quantization, model loading, tests, network calls, or file
  mutations at import time.
- Use `python -m package.module` for repository Python entrypoints.
- Shell scripts must call Python modules, not inline Python snippets.
- Files that are not intended to execute directly do not need a shebang.
- Directly executable Python files may use `#!/usr/bin/env python3` when a
  shebang is needed.

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

Avoid power features unless the project already has a clear local pattern and
the feature is necessary.

Avoid:

- custom metaclasses;
- bytecode manipulation;
- dynamic inheritance;
- object reparenting;
- import hooks and import hacks;
- runtime monkeypatching;
- reflection-heavy designs;
- modifying interpreter internals;
- `__del__` cleanup logic;
- manual descriptor implementations;
- dynamic code generation.

Allowed standard-library uses include `dataclasses`, `enum`, and `abc` when they
fit the problem.

Rules:

- Do not use a power feature to make code shorter.
- Do not use a power feature to hide a dependency cycle or ownership problem.
- Prefer ordinary functions, dataclasses, explicit imports, and explicit data
  structures.

## Threading and concurrency

Rules:

- Do not rely on atomicity of built-in types.
- Do not rely on atomic variable assignment for synchronization.
- Use `queue.Queue` for thread communication when appropriate.
- Use `threading` locks, conditions, or higher-level primitives for shared
  state.
- Prefer `threading.Condition` over low-level polling loops.
- Keep shared mutable state small and explicit.
- Document concurrency, cancellation, and isolation behavior when present.

## Tests

Rules:

- Test behavior, not implementation details.
- Use pytest-style `assert` in tests.
- Keep tests focused on the behavior under change.
- Do not add module docstrings to test files unless they explain unusual setup,
  environment requirements, or update commands.
- Do not assert hardcoded configuration values that can change freely.
- Use mocks only at external boundaries.
- Do not test that mocks return the values assigned inside the test.
- Cover meaningful edge cases, failure paths, and state transitions.

Good:

```python
def test_parse_prompt_rejects_unexpected_entry() -> None:
    with pytest.raises(TypeError, match="Unexpected prompt entry"):
        parse_prompt(value=object())
```

## Review checklist

Before running the requested checks, review the changed code:

- Are imports top-level, grouped, sorted, and free of cycles?
- Is the module import-stable, with no external work at import time?
- Are public APIs typed and documented, with accurate `__all__` exports?
- Do input types accept the intended protocols and return types describe actual values?
- Do precise types replace `Any` wherever the contract allows it?
- Are names consistent with the naming rules?
- Do functions have one responsibility and comply with configured size limits?
- Are defaults immutable, with explicit handling of `None`?
- Do constructors receive domain values instead of unrelated payload or CLI objects?
- Does inheritance represent an interface or true specialization?
- Are exceptions specific, `try` blocks narrow, and resource cleanup explicit?
- Is logging configured at the application boundary and free of secrets?
- Are environment values parsed and validated by their configuration owner?
- Are deployment dependencies pinned and integrity-checked as required by Packaging?
- Do comments explain non-obvious behavior without repeating the code?
- Are package boundaries respected without `sys.path` mutation?

For FastAPI applications, also review the FastAPI and Runtime guides. Check request and
response schemas, authorization, blocking I/O, resource lifetimes, and actual HTTP outcomes.
Report which requested checks ran and any verification that remains unavailable.

## Source decisions

These rules adapt PEP 8, PEP 257, and the Google Python Style Guide into one standard. Where they
disagree, the decision is:

| Topic                    | Decision                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Style authority          | These rules and the configured tools win over the source guides.                                                                                                                                                                                            |
| Line length              | The formatter's configured line length, not PEP 8's 79 or Google's 80.                                                                                                                                                                                      |
| Formatter and linters    | Ruff format, Ruff lint, basedpyright, and import-linter. Pylint guidance from Google maps to these tools.                                                                                                                                                   |
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

- Treat a lint failure as a policy failure.
- Do not add per-file ignores, inline ignores, or broad config exceptions. The exceptions are a
  tooling change the user asked for, or an unavoidable violation, and each carries a reason.

- Do not copy an existing per-file ignore into new files.
- Do not broaden an existing exception to make unrelated code pass.
- Do not disable a rule when a clear code change can satisfy it.
