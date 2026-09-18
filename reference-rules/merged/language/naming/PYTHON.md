---
layer: language
preset: python
title: Python Naming
---

# Python Naming

Python naming follows PEP 8, with the rules below.

## Python case rules

Rules:

- Modules and packages use `snake_case`. `enforced-by: naming/identifiers`
- Functions, methods, variables, and parameters use `snake_case`. `enforced-by: naming/identifiers`
- Classes, dataclasses, and exception types use `PascalCase`. `enforced-by: naming/identifiers`
- Constants use `UPPER_SNAKE_CASE`. `unenforced`
- CLI flags use lowercase kebab case, such as `--model-name` and
  `--output-dir`. `unenforced`
- Environment variables use `UPPER_SNAKE_CASE`. `unenforced`
- Avoid one-letter names except tiny conventional scopes such as `i` in a short
  loop. `enforced-by: naming/identifiers`
- Preserve provider capitalization in external names such as `HF_TOKEN` and
  provider repository IDs. `unenforced`
- Packages and directories are `snake_case`. Test files are `tests/test_<module>.py`, mirroring
  the package path. Support code is under `tests/support/`. `enforced-by: naming/identifiers`
- `handle` starts a name only for a signal, event, or framework callback (`handle_sigterm`).
  Never `Handler` as a class suffix. `enforced-by: naming/identifiers`

Bad:

```python
class tool_dataset:
    ...

MAXLEN = 512

def BuildExamples(data):
    ...
```

Good:

```python
class RuntimeConfig:
    ...

MAX_LENGTH = 512

def build_examples(source_items):
    ...
```

## Python modules and imports

Rules:

- Keep import aliases rare. Use aliases only for standard, widely understood
  conventions or real collision avoidance. `unenforced`
- Named imports keep their exported name unless a collision forces an alias. `unenforced`
- If aliasing is required, use a domain or module component that explains the
  collision. `unenforced`
- Do not create package-level re-export layers only to preserve old names. `unenforced`
- Keep `__all__` names accurate and ordered according to local lint rules. `unenforced`

Bad:

```python
from src.runtime.config import ModelSettings as Thing
```

Good:

```python
from src.runtime.config import ModelSettings
```

## Python types and dataclasses

Rules:

- Dataclass names describe the domain value they represent. `unenforced`
- Field names describe the value inside the owning type without repeating the
  type name. `unenforced`
- Use `Path` variables with names that reveal whether they point to a directory,
  file, model, result, or repository root. `unenforced`
- Use `*_path` for filesystem paths and `*_dir` only for directories. `unenforced`
- Use `*_id` only for real identifiers, not arbitrary names or labels. `unenforced`
- Use `*_name` for display or provider names. `unenforced`
- Use `*_key` for dictionary keys and supported variant keys. `unenforced`

Bad:

```python
@dataclass
class EvalExample:
    eval_example_text: str
    eval_example_result: str
```

Good:

```python
@dataclass
class EvalExample:
    text: str
    prediction: str
```

## Python boundary names

Rules:

- Keep raw provider or CLI names at the boundary. `unenforced`
- Translate external names into domain names before passing values inward when
  the external name is not the domain concept. `unenforced`
- Keep provider token lookup inside that provider's boundary. `unenforced`
- Keep path construction in config/path owners rather than rebuilding paths in
  business logic. `unenforced`
- Name functions that cross boundaries for the operation they perform. `unenforced`

Bad:

```python
def data(value):
    ...

token = os.environ["HF_TOKEN"]
```

Good:

```python
def build_readme(repo_id, base_model, variant_key):
    ...

token = read_token(cli_token)
```

## Identifiers

- Packages and modules use short, lowercase names. Use underscores when they
  improve readability. `unenforced`
- Classes use CapWords. `enforced-by: naming/identifiers`
- Exceptions use CapWords and end with `Error` when they represent errors. `enforced-by: naming/identifiers`
- Functions, methods, parameters, local variables, and instance variables use
  lowercase words separated by underscores. `unenforced`
- Constants use uppercase words separated by underscores. `unenforced`
- Type aliases use CapWords, with one leading underscore for internal aliases. `enforced-by: naming/identifiers`
- Private unconstrained type variables may use `_T` and `_P`. `unenforced`
- Avoid single-character names except for narrow counters, iterators, exception
  aliases such as `e`, file handles such as `f`, private unconstrained type
  variables, and established mathematical notation. `enforced-by: naming/identifiers`
- Never use `l`, `O`, or `I` as single-character names. `enforced-by: naming/identifiers`
- Use `self` for instance methods and `cls` for class methods. `unenforced`
- If a parameter conflicts with a keyword, append one trailing underscore. `enforced-by: naming/identifiers`

Good:

```python
class TrainingConfig:
    """Training configuration."""

def build_examples(source_items: list[object]) -> list[PromptExample]:
    """Build examples from raw items."""
    ...

MAX_EXAMPLES = 1000
class_: str
```

Bad:

```python
class runtime_config:
    ...

def buildExamples(data):
    ...

maxExamples = 1000
clss = "value"
```
