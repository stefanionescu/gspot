# SQL

## SQL style

- Fully qualify cross-schema references.
- Prefer explicit column lists for every `INSERT` and every grant of write
  privileges.
- Keep table constraints close to the table definition unless the migration must add them
  later for dependency reasons.
