---
title: Python Naming
---

# Python Naming

Python naming follows PEP 8, with the rules below.

## Command inputs and external names

<!-- level: all -->

Rules:

- CLI flags use lowercase kebab case, such as `--account-name` and
  `--output-dir`.
- Avoid single-letter names except loop counters and math notation.
- Preserve provider capitalization in external names such as `AWS_REGION` and
  provider resource IDs.

## Python modules and imports

<!-- level: all -->

Rules:

- Do not create package-level re-export layers only to preserve old names.
- Keep `__all__` names accurate and ordered according to local lint rules.

Import `AccountSettings` under its declared name. An alias such as `Thing`
hides the contract and provides no collision information.

## Python types and dataclasses

<!-- level: all -->

Rules:

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

## Python boundary names

<!-- level: all -->

Rules:

- Keep raw provider or CLI names at the boundary.
- Translate external names into domain names before passing values inward when
  the external name is not the domain concept.
- Keep path construction with the code that owns the resource instead of repeating it in
  unrelated operations.
- Name functions that cross boundaries for the operation they perform.
