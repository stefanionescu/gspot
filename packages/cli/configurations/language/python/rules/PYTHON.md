# Python

Read this rule when you change Python code.

## Python scope

Write readable Python before clever Python: explicit data flow, clear names, small functions,
and the formatter's layout.
Importing a module does no I/O, starts no work, and parses no arguments. Prefer the project's rules to generic style guides, and consistency with the
surrounding module where a guide allows more than one style.

## Runtime and files

Use the syntax of the declared Python version, stated once in the runtime pin, and name
version requirements in examples whose syntax depends on them. Use `.py` for source and
`.pyi` for stubs.

### Comment language

<!-- level: all -->

Write comments and docstrings in the project's declared language. Accept valid user content outside ASCII.

## Environment and configuration

An importable module never depends on an active shell, a virtual environment, the working directory, or a
globally installed package. Imports resolve through project configuration, editable
installs, `python -m`, or the configured environment. Virtual environments and package caches
stay out of commits.

The module that reads the configuration takes the environment as a mapping, so a test passes its own:

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

## Module structure

<!-- level: all -->

Every runtime module has a docstring describing its present purpose.

## Imports

Imports resolve in the declared project environment, never through the script directory on
`sys.path`, and break cycles by moving shared data or interfaces into a lower-level module.

### Import conventions

<!-- level: all -->

Imports sit at the top after the docstring and future imports, one per line, with typing and
`collections.abc` symbols imported directly. Use absolute cross-package imports; explicit
relative imports serve siblings inside a package where surrounding code does that. Never an
implicit relative import, a wildcard import, an import inside a function, method, or class
body in runtime code, or a dynamic import through `importlib.import_module`, `__import__`, or
`builtins.__import__`.

Direct symbol imports keep call sites readable; use a module import when
its prefix identifies the module, as `logging.getLogger(__name__)` does. Give every alias a reason. Two modules can share a final name, a module can collide with a local
name, or a name can have too many words for the call site. A standard abbreviation such as `np` and a
disambiguated generic name provide the other reasons.

## Docstrings

Docstrings match their signatures and behavior at both levels, in the project's declared
convention. Use the explicit pydoclint style when the settings define one. Otherwise, follow the Google
or NumPy convention that Ruff carries, and failing that the pydoclint default. The examples
here follow Google style.

### Docstring conventions

<!-- level: all -->

- A class docstring says what an instance represents, never `Class that...`.
- A function that mutates an argument says so.

## Constants, globals, and mutable state

Prefer module constants. Do not expose mutable global state, lazy singletons, or mutable globals as
public API. Required mutable state stays internal with its design reason documented,
and no ordinary call mutates a module global as a hidden side effect. Validated configuration
passes into the client or operation that consumes it, without a renaming wrapper.

### Constant naming

<!-- level: all -->

Name constants `UPPER_SNAKE`, private ones with one leading underscore, and retained module
state takes a name for its concept.

## Main programs

An executable module puts its behavior in `main()`, runs it under the `__main__` guard, and
prefers `raise SystemExit(main())` when `main()` returns an exit code.
Repository entrypoints run as `python -m package.module`, and shell scripts call Python
modules rather than inline snippets. A shebang appears only on a file meant to execute
directly.

Never execute untrusted input as Python code, and dynamic execution never replaces input
validation.

## Power features

<!-- level: all -->

Avoid power features unless the project already uses the feature and no plain alternative works. That covers custom metaclasses, bytecode manipulation, dynamic inheritance, object
reparenting, import hooks, runtime monkeypatching, and reflection-heavy designs. It also
covers interpreter internals, `__del__` cleanup, manual descriptors, and dynamic code
generation. A power feature never makes code shorter or hides a dependency cycle; ordinary
functions, dataclasses, explicit imports, and explicit data structures come first.

## Threading

Built-in types and variable assignment do not synchronize threads: use `queue.Queue` for thread
communication and locks or conditions for shared state, which stays small and explicit.

## Naming

### Command inputs and external names

<!-- level: all -->

- CLI flags use lowercase kebab case, such as `--account-name` and
  `--output-dir`.
- Avoid single-letter names except loop counters and math notation.
- Preserve provider capitalization in external names such as `AWS_REGION` and
  provider resource IDs.

### Python modules and imports

<!-- level: all -->

- Name test files `test_<behavior>.py`, grouped by behavior.

- Do not create package-level re-export layers only to preserve old names.
- Keep `__all__` names accurate and ordered according to local lint rules.

Import `AccountSettings` under its declared name. An alias such as `Thing`
hides the contract and provides no collision information.

### Python types and dataclasses

<!-- level: all -->

- Dataclass names describe the domain value they represent.
- Field names describe the value inside the owning type without repeating the
  type name.
- Use `Path` variables with names that reveal whether they point to a directory,
  file, report, output, or repository root.
- Use `*_path` for filesystem paths and `*_dir` only for directories.
- Use `*_id` only for real identifiers, not arbitrary names, or labels.
- Use `*_name` for display or provider names.
- Use `*_key` for dictionary keys and supported variant keys.

| Avoid                    | Prefer           | Meaning             |
| ------------------------ | ---------------- | ------------------- |
| `Invoice.invoice_number` | `Invoice.number` | The invoice number. |
| `Shipment.shipment_date` | `Shipment.date`  | The shipment date.  |

### Python boundary names

<!-- level: all -->

- Keep raw provider or CLI names at the boundary.
- Translate external names into domain names before passing values inward when
  the external name differs from the domain concept.
- Keep path construction with the code that owns the resource instead of repeating it in
  unrelated operations.
- Name functions that cross boundaries for the operation they perform.
