---
title: Python Naming
---

# Python Naming

Python naming follows PEP 8, with the rules below.

## Python case rules

<!-- level: all -->

Rules:

- Modules and packages use `snake_case`.
- Functions, methods, variables, and parameters use `snake_case`.
- Classes, dataclasses, and exception types use `PascalCase`.
- Constants use `UPPER_SNAKE_CASE`.
- CLI flags use lowercase kebab case, such as `--model-name` and
  `--output-dir`.
- Environment variables use `UPPER_SNAKE_CASE`.
- Avoid one-letter names except tiny conventional scopes such as `i` in a short
  loop.
- Preserve provider capitalization in external names such as `HF_TOKEN` and
  provider repository IDs.
- Packages and directories are `snake_case`. Test files are `tests/test_<module>.py`, grouped
  by the behavior they verify. Support code is in the harness folder that
  `architecture.roles.harness` names.
- `handle` starts a name only for a signal, event, or framework callback (`handle_sigterm`).
  Never `Handler` as a class suffix.

| Avoid            | Prefer           | Meaning                            |
| ---------------- | ---------------- | ---------------------------------- |
| `runtime_config` | `RuntimeConfig`  | A configuration type.              |
| `MAXLEN`         | `MAX_LENGTH`     | A maximum length constant.         |
| `BuildExamples`  | `build_examples` | An example construction operation. |

## Python modules and imports

<!-- level: all -->

Rules:

- Keep import aliases rare. Use aliases only for standard, widely understood
  conventions or real collision avoidance.
- Named imports keep their exported name unless a collision forces an alias.
- If aliasing is required, use a domain or module component that explains the
  collision.
- Do not create package-level re-export layers only to preserve old names.
- Keep `__all__` names accurate and ordered according to local lint rules.

Import `ModelSettings` under its declared name. An alias such as `Thing`
hides the contract and provides no collision information.

## Python types and dataclasses

<!-- level: all -->

Rules:

- Dataclass names describe the domain value they represent.
- Field names describe the value inside the owning type without repeating the
  type name.
- Use `Path` variables with names that reveal whether they point to a directory,
  file, model, result, or repository root.
- Use `*_path` for filesystem paths and `*_dir` only for directories.
- Use `*_id` only for real identifiers, not arbitrary names, or labels.
- Use `*_name` for display or provider names.
- Use `*_key` for dictionary keys and supported variant keys.

| Avoid                             | Prefer                   | Meaning           |
| --------------------------------- | ------------------------ | ----------------- |
| `EvalExample.eval_example_text`   | `EvalExample.text`       | Input text.       |
| `EvalExample.eval_example_result` | `EvalExample.prediction` | Predicted output. |

## Python boundary names

<!-- level: all -->

Rules:

- Keep raw provider or CLI names at the boundary.
- Translate external names into domain names before passing values inward when
  the external name is not the domain concept.
- Keep provider token lookup inside that provider's boundary.
- Keep path construction in config/path owners rather than rebuilding paths in
  business logic.
- Name functions that cross boundaries for the operation they perform.

Name a README construction operation `build_readme` and use `repo_id`,
`base_model`, and `variant_key` for its domain inputs. A generic name such as
`data` does not identify the operation. Keep token acquisition inside the
provider boundary and name it according to the retrieval convention.

## Identifiers

<!-- level: all -->

- Packages and modules use short, lowercase names. Use underscores when they
  improve readability.
- Classes use CapWords.
- Exceptions use CapWords and end with `Error` when they represent errors.
- Functions, methods, parameters, local variables, and instance variables use
  lowercase words separated by underscores.
- Constants use uppercase words separated by underscores.
- Type aliases use CapWords, with one leading underscore for internal aliases.
- Private unconstrained type variables may use `_T` and `_P`.
- Avoid single-character names except for narrow counters, iterators, exception
  aliases such as `e`, file handles such as `f`, private unconstrained type
  variables, and established mathematical notation.
- Never use `l`, `O`, or `I` as single-character names.
- Use `self` for instance methods and `cls` for class methods.
- If a parameter conflicts with a keyword, append one trailing underscore.

| Avoid            | Prefer           | Meaning                                         |
| ---------------- | ---------------- | ----------------------------------------------- |
| `runtime_config` | `RuntimeConfig`  | A type.                                         |
| `buildExamples`  | `build_examples` | A function.                                     |
| `maxExamples`    | `MAX_EXAMPLES`   | A module-level constant.                        |
| `clss`           | `class_`         | A parameter whose role collides with a keyword. |
