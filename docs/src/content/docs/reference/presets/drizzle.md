---
title: "Drizzle"
description: "Drizzle: no update or delete without a where, raw SQL only where the policy allows it, relations for every reference, and migrations that match the schema."
---

Drizzle: no update or delete without a where, raw SQL only where the policy allows it, relations for every reference, and migrations that match the schema.

Kind: library. Requires: `javascript`.

## Tools

- eslint-plugin-drizzle 0.2.3
- drizzle-kit

## Generated configuration

- `.gspot/eslint.config.mjs`

## Checks

| Check                                                                        | Stage  | What it finds                                                       |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| [`drizzle/relations-complete`](/reference/rules/drizzle/relations-complete/) | commit | Checks that every table with a reference has a relations entry.     |
| [`drizzle/migrations-fresh`](/reference/rules/drizzle/migrations-fresh/)     | push   | Asks drizzle-kit to write migrations, and fails when it writes one. |

## Settings

- `tools.drizzle.raw_sql_allowed`: Paths that may hold raw SQL templates, each with a reason.

## Rule files

- `library/drizzle/DRIZZLE.md`
