---
layer: language
kit: sql
title: SQL
---

# SQL

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## SQL style

- Use uppercase SQL keywords.
- Fully qualify cross-schema references, especially inside functions and RLS
  policies.
- Prefer explicit column lists for every `INSERT` and every grant of write
  privileges.
- Preserve applied migration history. Use idempotent DDL only when repeated execution is an
  explicit contract and existing object definitions are verified. Do not hide schema drift
  with `IF NOT EXISTS`.
- Keep table constraints close to the table definition unless they must be added
  later for dependency reasons.
- Use comments to explain business invariants, security boundaries, and
  non-obvious platform behavior. Do not comment obvious SQL syntax.
- Do not leave placeholder comments, TODOs, fake examples, or unexplained
  suppressions in migrations.

## Migration layout

<!-- level: all -->

When the project selects the documented migration layout, put indexes in its
`Indexes` section and grants and revokes in its `Grants` section. The configured
migration-documentation check owns the required sections.
