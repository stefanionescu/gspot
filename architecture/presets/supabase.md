# supabase

Kind: platform. Requires: postgres, sql, typescript, config-files.

## Detects and claims

|                         |                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detect                  | `supabase/config.toml`                                                                                                                           |
| Claims                  | `supabase/migrations/**`, `supabase/functions/**`, `supabase/config.toml`, `supabase/seed.sql`, the generated types file the repository declares |
| Architecture it assumes | the Supabase CLI layout, because the CLI dictates it                                                                                             |

## Tools

supabase (CLI), deno, the Semgrep Supabase rule pack.

## Generated configuration

| Target                             | Holds                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.gspot/deno.json`                 | lint and fmt options for edge functions; each function's own `deno.json` is a stub that extends it |
| ESLint override for `functions/**` | Deno globals; `n/*` and `n/prefer-promises/*` off; `import_style = "ts"`                           |
| `.gspot/sqlfluff.cfg`              | dialect `postgres` (through postgres)                                                              |
| `.gspot/v8r.yml`                   | the `config.toml` schema                                                                           |

## Checks

| Id                                  | Stage        | Command                                                                                                                                                                                                         |
| ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/config`                   | commit       | `config.toml` validates against the CLI schema                                                                                                                                                                  |
| `supabase/deno-lint`                | commit       | `deno lint --config .gspot/deno.json <function>` per function                                                                                                                                                   |
| `supabase/deno-fmt`                 | commit       | `deno fmt --check`                                                                                                                                                                                              |
| `supabase/deno-check`               | commit       | `deno check` per function entry                                                                                                                                                                                 |
| `supabase/migration-names`          | commit       | naming engine `snake-migration`                                                                                                                                                                                 |
| `supabase/types-fresh`              | push         | `supabase gen types` matches the declared file (`[[declare]] produced_by`)                                                                                                                                      |
| `supabase/storage-policies`         | commit       | every bucket in `config.toml` has an RLS policy in a migration                                                                                                                                                  |
| `supabase/service-role-containment` | commit       | ast-grep: the service-role key name appears only in server files and never in `functions/**` client bundles                                                                                                     |
| `security/semgrep` supabase pack    | push         | raw SQL interpolation, RPC with user input, service-role key in client code, RLS bypass, wildcard CORS with credentials, unvalidated JSON body, dynamic import, `eval`, secrets in logs, hard-coded service key |
| `postgres/*`                        | see postgres | migration safety, docs, immutability                                                                                                                                                                            |

## Settings

`tools.supabase.types_file`, `tools.supabase.functions_dir` (default `supabase/functions`),
`tools.deno.lint_rules`.

## Rule files

`platform/supabase/SUPABASE.md`, `database/postgres/POSTGRES.md`, `runtime/deno/DENO.md`;
`templates/project/SUPABASE-DEPLOYMENT.md` offered at init.
