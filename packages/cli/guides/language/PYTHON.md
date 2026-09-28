---
layer: language
kit: python
title: Python
---

# Python

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

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

Keep each module focused on a real input, output, or state owner. The
configuration and command examples below include every import, type, and
operation they use.

## Runtime, encoding, and files

Rules:

- Use the syntax of the project's declared Python version. The version is stated once, in the
  runtime pin. State version requirements in examples when their syntax depends on them.
- Store source files as UTF-8.
- Do not add an encoding declaration unless a tool or runtime requires it.
- Use LF line endings.
- Do not use byte-order marks.
- Use `.py` for Python source and `.pyi` for type stubs.
- Keep modules importable by pydoc, tests, linting tools, and type checkers.

Good:

```text
model_config.py
modeling.py
__main__.py
```

### File and identifier conventions

<!-- level: all -->

Use snake_case filenames and ASCII identifiers, preserving names required by external contracts.
Keep comments and docstrings in the project's declared language. Unicode string data follows the
application's text requirements; do not restrict valid user content to ASCII.

## Environment and configuration

Rules:

- Treat environment variables as external text input.
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
"""Parse positive item limits before starting application work."""

from __future__ import annotations

from typing import TYPE_CHECKING
from dataclasses import dataclass

if TYPE_CHECKING:
    from collections.abc import Mapping


@dataclass(frozen=True)
class AppConfig:
    """Validated application settings.

    Attributes:
        max_items: Positive maximum number of items to process.

    """

    max_items: int


def get_config(environ: Mapping[str, str]) -> AppConfig:
    """Parse an item limit, using 100 when the setting is absent.

    Args:
        environ: Environment values supplied by the application boundary.

    Returns:
        Settings containing a positive item limit.

    Raises:
        ValueError: The supplied limit is not an integer greater than zero.

    """
    max_items = int(environ.get("MAX_ITEMS", "100"))
    if max_items < 1:
        message = "MAX_ITEMS must be greater than zero"
        raise ValueError(message)
    return AppConfig(max_items=max_items)


__all__ = ["AppConfig", "get_config"]
```

### Environment ownership

<!-- level: all -->

Read `os.environ` and `os.getenv` in the configuration owner, and pass validated values inward.
Keep framework-owned entrypoints and other declared boundaries consistent with their contracts.

## Module structure

<!-- level: all -->

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

The configuration example places its module docstring and imports first,
then its dataclass and public function. Its explicit `__all__` is last.
A helper belongs before the public API only when it owns real behavior;
do not add a forwarding function to illustrate declaration order.

## Imports

Imports must resolve in the declared project environment. Do not rely on the main script directory
being present on `sys.path`. Avoid import cycles and remove unused imports.

### Import conventions

<!-- level: all -->

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

Keep standard-library imports before third-party imports, and put the
project's own imports in their configured section. Import only symbols the
module actually uses. Do not copy an illustrative block of unused imports.

Direct symbol imports keep public types and functions readable at the call
site. A module import is useful when its prefix identifies ownership. For
example, `logging.getLogger(__name__)` identifies the logging API without
creating an unrelated alias.

Use aliases only when:

- two imported modules have the same final name.
- an imported module conflicts with a local top-level name.
- the original module name is inconveniently long.
- the alias is a standard abbreviation, such as `np` for NumPy.
- the alias disambiguates a generic module name.

## Public and internal interfaces

<!-- level: all -->

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

Use `_DEFAULT_TIMEOUT_SECONDS` for a private timeout constant and list only
the public operation in `__all__`. A private name is not a substitute for
removing a helper that only forwards a call.

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

A comment can explain a non-obvious format constraint or resource lifetime.
Do not repeat an assignment in prose or introduce domain behavior solely to
create a comment example.

When a native linter requires a suppression for an unavoidable external
contract, keep it narrow and include the reason on or immediately above the
directive. A deterministic random generator can require a security-rule
exception for simulation; it must never produce security tokens.

### Docstring validation

Existing docstrings must match their function signatures and actual behavior at both levels.
Keep the project's declared convention. An explicit pydoclint style wins; otherwise a
Google or NumPy convention from Ruff carries into pydoclint. Without either setting,
the native pydoclint default applies. Google-style examples below illustrate that selected
convention; use NumPy section syntax when the project selects NumPy.

### Docstrings

<!-- level: all -->

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
- Summary lines are imperative: `Return the total token budget.`, not `Returns the total token budget.`.

A one-line summary such as "Return a new list containing the supplied labels."
describes the caller-visible result. Do not add a named function for a
one-expression calculation solely to demonstrate a docstring.

The `get_config` example includes a complete Google-style multiline
docstring. Its sections describe the actual accepted input and result.

### Module docstrings

<!-- level: all -->

Rules:

- Runtime modules start with a docstring describing the module's purpose.
- A module docstring may include a short usage example when it helps callers.
- Test modules do not need a module docstring unless they need unusual setup,
  environment, or update instructions.
- Do not write a test module docstring that only repeats the file name or module
  name.

Use a module summary such as "Parse positive item limits before starting
application work." It states the purpose without repeating the filename.

### Function and method docstrings

<!-- level: all -->

Rules:

- Public functions and methods require docstrings.
- Nontrivial private helpers require docstrings.
- Functions with non-obvious logic require docstrings.
- Functions that mutate an argument must say so.
- Document yielded values in the selected convention's yields section.
- `Returns:` may be omitted when the one-line summary already fully describes
  the returned value.
- Do not document `None` returns unless it clarifies control flow.
- In Google style, use `Args:`, `Returns:`, `Yields:`, and `Raises:` sections when needed.
- In NumPy style, use the corresponding underlined section headings.
- Keep section indentation consistent within a file.

The `get_config` example documents its input mapping, returned settings, and
invalid-input exception. Each section matches its implementation. Do not
document a return value or error that the function does not produce.

### Class docstrings

<!-- level: all -->

Rules:

- Public classes require docstrings.
- A class docstring starts with a one-line summary describing what an instance
  represents.
- Public attributes, excluding properties, are documented in an `Attributes:`
  section.
- Exception class docstrings describe the condition represented by the
  exception, not the raising site.
- Do not write `Class that...` as the summary.

The `AppConfig` class documents `max_items` under `Attributes`. Public
attributes belong in the class contract; properties have their own
attribute-style documentation.

A `MissingArtifactError` docstring can state "The requested artifact is
unavailable." Keep the exception with the behavior that raises it and do not
repeat the class name as its entire documentation.

### Property docstrings

<!-- level: all -->

Rules:

- Property docstrings describe the attribute, not the method action.
- Use attribute-style wording.
- Do not write `Returns...` for a property unless the surrounding file already
  uses that style.

A computed `num_labels` property can use "The number of supported labels."
Its implementation must preserve the documented cost and side effects.

### Override docstrings

<!-- level: all -->

Rules:

- An overridden method may omit a docstring when it is decorated with
  `@override` and does not materially change the base contract.
- Add a docstring when an override changes behavior, side effects, constraints,
  or return semantics.
- Use `typing.override` when available in the target runtime. Use
  `typing_extensions.override` when needed.

Use `@override` for a real override that preserves or deliberately refines a
base contract. Do not add a method that only calls `super` to demonstrate
inherited documentation; the inherited method already provides that behavior.

### Deferred work

<!-- level: all -->

Track unfinished work in the issue tracker. Do not leave `TODO`, `FIXME`, `XXX`, or `HACK`
placeholders in source. A comment can link to an issue that explains an existing constraint,
but it must describe the current behavior and reason.

A comment can explain that a required CSV input follows an upstream
exporter's contract, with a link to the issue that documents the constraint.
It must describe current behavior rather than promise a future change.

## Constants, globals, and mutable state

Rules:

- Module constants are allowed and encouraged.
- Avoid mutable global state.
- Do not use lazy singleton state.
- Do not expose mutable globals directly as public API.
- If mutable global state is genuinely required, keep it internal and document
  the design reason.
- Do not mutate module globals as a hidden side effect of ordinary function
  calls.

Use a named constant for a meaningful repeated value, such as
`DEFAULT_BATCH_SIZE`. Keep mutable runtime state with its behavioral owner
and pass it explicitly to operations that need it.

Pass validated configuration into the client or operation that consumes it.
Do not wrap a constructor only to rename the same construction call.

### Constant conventions

<!-- level: all -->

Use uppercase names with underscores for constants and one leading underscore for private
constants. Name retained module state for the concept it owns.

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
"""Count nonempty lines from a pipeline."""

import sys


def main() -> int:
    """Count nonempty input lines from standard input."""
    count = sum(1 for line in sys.stdin if line.strip())
    _ = sys.stdout.write(f"{count}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Never execute untrusted input as Python code or use dynamic execution to avoid input validation.

## Power features

<!-- level: all -->

Avoid power features unless the project already has a clear local pattern and
the feature is necessary.

Avoid:

- custom metaclasses.
- bytecode manipulation.
- dynamic inheritance.
- object reparenting.
- import hooks and import hacks.
- runtime monkeypatching.
- reflection-heavy designs.
- modifying interpreter internals.
- `__del__` cleanup logic.
- manual descriptor implementations.
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

Test `get_config` with absent, valid, nonnumeric, and nonpositive limits.
Assert the accepted settings or the documented `ValueError`, rather than
testing that a mock returns its configured value.

## Review checklist

<!-- level: all -->

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

Review the FastAPI and Runtime guides when working on FastAPI applications. Check request and
response schemas, authorization, blocking I/O, resource lifetimes, and actual HTTP outcomes.
Report which requested checks ran and any verification that remains unavailable.

## Source decisions

<!-- level: all -->

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
| Function and file length | The configured limits apply to authored modules, including package initializers.                                                                                                                                                                            |
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
