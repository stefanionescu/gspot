---
title: Python
---

# Python

The Python rules span five files: this one (modules, imports, interfaces, docstrings, entry
points), Typing, Design (functions and classes), Flow (control flow, errors, logging,
resources), and Packaging (installs and dependencies).

## Core Python philosophy

Write readable Python before clever Python: explicit data flow, clear names, small functions,
and the formatter's layout, with the surrounding file deciding where it allows more than one.
Keep code import-stable; importing a module loads no model, initializes no engine, touches no
external service, starts no background work, parses no arguments, and mutates no runtime
state. Prefer the project's rules to generic style guides, and consistency with the
surrounding module where a guide allows more than one style.

Make no style-only churn outside the requested scope. Replace an obsolete API, wrapper,
re-export, or alternate code path completely rather than preserving it. Public behavior is
clear through names, annotations, docstrings, and tests. Exceptions serve exceptional
conditions, not ordinary branches. Each module owns a real input, output, or state.

## Runtime, encoding, and files

Use the syntax of the declared Python version, stated once in the runtime pin, and name
version requirements in examples whose syntax depends on them. Source is UTF-8 with LF
endings, no byte-order mark, `.py` for source and `.pyi` for stubs, importable by pydoc,
tests, linters, and type checkers.

### File naming

<!-- level: all -->

Filenames are snake_case and identifiers ASCII, preserving names an external contract
requires. Comments and docstrings use the project's declared language, and valid user content
is never restricted to ASCII.

## Environment and configuration

Environment variables are external text input. The configuration owner parses and validates
them once before the values pass inward. Secrets live in environment variables or a secret
manager, never in source, examples, tests, or checked-in configuration. A missing required
secret fails at startup rather than falling back to a real-looking default.

An importable module never depends on an active shell, a virtual environment, the working directory, or a
globally installed package. Imports resolve through project configuration, editable
installs, `python -m`, or the configured environment. Virtual environments and package caches
are not committed.

```python
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
```

### Configuration ownership

<!-- level: all -->

`os.environ` and `os.getenv` are read in the configuration owner alone, and framework-owned
entrypoints keep to their declared boundaries.

## Module structure

<!-- level: all -->

A module runs docstring, `from __future__ import annotations`, other dunders except
`__all__`, imports, constants, type aliases, classes, functions, the `__main__` guard, and
`__all__` last. Internal definitions come before the first public one, so a reader meets the
helpers before the code that uses them; the TypeScript and Bash rules say the same. Python
resolves names at call time, so the order carries no runtime meaning. Every runtime module has
a docstring describing its present purpose. Top-level code is declarations, constants,
imports, and cheap initialization: no I/O, network, model loading, argument parsing, or long
computation at import time.

`__all__` is explicit for a module with a public API and `__all__ = []` for one that exports
nothing on purpose. Every top-level name outside it starts with one underscore. A helper is
written only when it owns behavior; a forwarding function is not an illustration of order.

## Imports

Imports resolve in the declared project environment, never through the script directory on
`sys.path`, and cycles are broken by moving shared data or contracts into a lower-level owner.
Ruff sorts the sections, `__future__`, standard library, third-party, first-party, local, and
the same order applies inside a bare `if TYPE_CHECKING:` body.

### Import conventions

<!-- level: all -->

Imports sit at the top after the docstring and future imports, one per line, with typing and
`collections.abc` symbols imported directly. Cross-package imports are absolute; explicit
relative imports serve siblings inside a package where surrounding code does that. Never an
implicit relative import, a wildcard import, an import inside a function, method, or class
body in runtime code, or a dynamic import through `importlib.import_module`, `__import__`, or
`builtins.__import__`. Direct symbol imports keep call sites readable; a module import is
useful when its prefix identifies ownership, as `logging.getLogger(__name__)` does. An alias
exists only for a reason: two modules share a final name, a module collides with a local
name, or the name is inconveniently long. A standard abbreviation such as `np` and a
disambiguated generic name are the other reasons.

## Public and internal interfaces

<!-- level: all -->

Public names are for callers outside the module; internal names carry one leading
underscore, and every underscored definition comes before the first public one. Double
leading underscores exist only to avoid subclass collisions in a class designed for
inheritance, and no invented dunder names exist. `__all__` declares the exports, and an
imported name is an implementation detail unless exported there. A private name never
replaces removing a helper that only forwards a call.

## Comments and docstrings

Comments and docstrings describe present behavior only: no change history, no mention of
removed or renamed code, no file paths unless essential and stable, complete sentences, and
clean grammar. A comment explains intent, invariants, edge cases, and non-obvious choices such
as a format constraint or a resource lifetime; it does not narrate obvious code. When a native
linter needs a suppression for an unavoidable external contract, keep it narrow with the
reason on or above the directive. A deterministic random generator may need a security-rule
exception for simulation and must never produce tokens. Unfinished work lives in the issue
tracker, not in `TODO`, `FIXME`, `XXX`, or `HACK`. A comment may link to an issue that explains
an existing constraint while describing current behavior.

Docstrings match their signatures and behavior at both levels, in the project's declared
convention. That is an explicit pydoclint style when one is set. Otherwise, it is the Google
or NumPy convention that Ruff carries, and failing that the pydoclint default. The examples
here are Google style.

### Docstring conventions

<!-- level: all -->

- Docstrings use triple double quotes. Public modules, functions, classes, and methods, and
  nontrivial private functions, have one; obvious private helpers do not.
- A one-line docstring stays on one line and ends with punctuation. A multiline one opens
  with a summary, a blank line, and details, with the closing quotes on their own line. The
  summary is imperative, `Return the total token budget.`, and never restates the signature.
- Document arguments, return values, yielded values, side effects, and raised exceptions that
  are part of the interface, in `Args:`, `Returns:`, `Yields:`, and `Raises:` sections. An
  exception raised only when a caller violates the contract is not documented.
- `Returns:` may be omitted when the summary describes the value, and `None` returns are
  documented only when they clarify control flow. A function that mutates an argument says so.
- A module docstring states the purpose without repeating the filename and may hold a short
  usage example; a test module needs one only for unusual setup.
- A class docstring says what an instance represents, never `Class that...`, and lists public
  attributes (not properties) under `Attributes:`. An exception class describes the condition,
  not the raising site. A property docstring describes the attribute in attribute-style
  wording.
- An overridden method decorated with `@override` (`typing.override`, or
  `typing_extensions.override` where needed) may omit its docstring when it keeps the base
  contract. It gets one when it changes behavior, side effects, constraints, or return
  semantics.

## Constants, globals, and mutable state

Module constants are encouraged; mutable global state, lazy singletons, and mutable globals as
public API are not. Required mutable state stays internal with its design reason documented,
and no ordinary call mutates a module global as a hidden side effect. Validated configuration
is passed into the client or operation that consumes it, without a renaming wrapper.

### Constant naming

<!-- level: all -->

Constants are `UPPER_SNAKE`, private ones with one leading underscore, and retained module
state is named for the concept it owns.

## Main programs

An executable module puts its behavior in `main()`, runs it under the `__main__` guard, and
prefers `raise SystemExit(main())` when `main()` returns an exit code. Nothing parses
arguments, loads models, runs tests, calls the network, or mutates files at import time.
Repository entrypoints run as `python -m package.module`, and shell scripts call Python
modules rather than inline snippets. A shebang appears only on a file meant to execute
directly.

Untrusted input is never executed as Python code, and dynamic execution never replaces input
validation.

## Power features

<!-- level: all -->

Power features are avoided unless the project has a clear local pattern and the feature is
necessary. That covers custom metaclasses, bytecode manipulation, dynamic inheritance, object
reparenting, import hooks, runtime monkeypatching, and reflection-heavy designs. It also
covers interpreter internals, `__del__` cleanup, manual descriptors, and dynamic code
generation. A power feature never makes code shorter or hides a dependency cycle; ordinary
functions, dataclasses, explicit imports, and explicit data structures come first.

## Threading and tests

Built-in types and variable assignment are not synchronization: use `queue.Queue` for thread
communication and locks or conditions for shared state, which stays small and explicit.

Tests cover behavior, not implementation, with pytest-style `assert`, focused on the behavior
under change. Mocks sit only at external boundaries, and no test asserts a mock's own return
value. Cover edge cases, failure paths, and state transitions: `get_config` is tested with
absent, valid, nonnumeric, and nonpositive limits.

## Source decisions

<!-- level: all -->

These rules adapt PEP 8, PEP 257, and the Google Python Style Guide into one standard.

| Topic            | Decision                                                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line length      | The formatter's configured line length, not PEP 8's 79 or Google's 80.                                                                                                                                                                                      |
| Imports          | Absolute across packages; explicit relative sibling imports inside a package when that is the local pattern; direct imports of public symbols and of typing and `collections.abc` names.                                                                    |
| `__all__`        | At the bottom of the module. Other dunders such as `__version__` sit after the docstring and future imports.                                                                                                                                                |
| Typing           | Every function annotated; modern union syntax, built-in generics, `type` statements or `TypeAlias` for real aliases, `Annotated` for metadata, `object` for any value, protocols for structural interfaces; abstract input types and concrete return types. |
| Logging          | `logging.getLogger(__name__)` in modules; entrypoints configure handlers; libraries add only `NullHandler`.                                                                                                                                                 |
| Project layout   | Importable code under `src/`; no `sys.path` patches.                                                                                                                                                                                                        |
| Inheritance      | Composition for code sharing, protocols for interfaces, subclassing only for true specialization.                                                                                                                                                           |
| Package installs | Pinned, hashed, binary-only requirements for deployments; no direct setuptools commands.                                                                                                                                                                    |

A lint failure is a policy failure. No per-file ignore, inline ignore, or broad exception is
added, copied into a new file, or broadened for unrelated code. The exceptions are a tooling
change the user asked for and an unavoidable violation, each with a reason. Neither applies
where a clear code change satisfies the rule.
