# `language:sql`

## Three presets, not one

The question of whether Supabase needs its own linting has a three-part answer, and getting the
split right is what stops the SQL work from being too narrow to reuse.

| Preset                 | Holds                                                                                                                                                            | Serves                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `language:sql`       | SQL as a language: parsing, formatting, style, naming, prose in comments                                                                                         | any SQL, any dialect                                                |
| `database:postgres` | RLS, grants, `SECURITY DEFINER` search path, migration safety, migration order, migration immutability, object naming, index-covers-foreign-key, no blocking DDL | any Postgres project: raw SQL, Drizzle, Prisma, Neon, RDS, Supabase |
| `platform:supabase` | the CLI filename contract, `config.toml`, edge functions, generated types freshness, storage policies, service-role key containment                              | Supabase only                                                       |

Nine of the fourteen non-language checks sit in `database:postgres`, and none of them mentions
Supabase. That is deliberate: **the general work lives in the general preset.** A Neon project selects
two presets and gets nine checks. A Supabase project selects three and gets fourteen. Nothing is
duplicated, and nothing useful is trapped behind a product name.

The same shape applies to every database preset that follows. `library:drizzle` and
`framework:prisma` require `database:postgres` and add only what their own tooling dictates.

The language with the worst measured coverage in the reference set: 25 of 83 files linted, and the
cause was one line in an ignore file.

## Claims

```text
.sql .pgsql .psql
```

`.pgsql` matters. The reference repository has nine `.pgsql` helper files that match nothing,
because `sqlfluff`'s `sql_file_exts` was never overridden and defaults to `.sql` only. The preset sets
`sql_file_exts = .sql,.pgsql,.psql` and the files a check reads proves it.

## Tools

| Kind        | Tool                                  | Notes                                                                                                                    |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| format            | `sqlfluff format`                     | Dialect from the framework preset, `postgres` under `platform:supabase`                                                   |
| syntax            | `libpg-query`                         | The real PostgreSQL parser. Catches what sqlfluff's dialect parser tolerates.                                            |
| style             | `sqlfluff lint`                       |                                                                                                                          |
| structure, naming | gspot structure engine, `libpg-query` | Function length, doc comments, naming policy for tables, columns, functions, indexes, constraints, triggers and policies |
| migration safety  | `squawk`                              | Under `platform:supabase`, scoped to new migrations                                                                     |
| prose             | Vale through stdin as `.lua`          | `--` comments, including inside PL pgSQL bodies. Misses `/* */`, which the preset therefore bans.                          |
| spelling          | `typos`                               |                                                                                                                          |
| tests             | `pgTAP`                               | Under `platform:supabase`                                                                                               |

### No SAST

Stated plainly: no maintained tool reads SQL for injection or privilege patterns.
`platform:supabase` compensates with RLS presence checks and grant policy, and
`repository:vulnerabilities` runs Semgrep over the TypeScript that builds SQL strings. A SQL file
itself gets `syntax`, `style`, `structure` and `naming` and no `vulnerabilities`, and the required kinds says so
rather than pretending.

### The block comment ban

Vale reads `--` comments through the Lua grammar and does not read `/* */`. The preset therefore bans
`/* */` in SQL, so that prose coverage is total rather than partial. The reference tree has zero
block comments, so the ban costs nothing. This is a case where a lint rule exists to make another
lint rule complete, and that is a legitimate reason as long as it is written down.

## Required kinds

```text
.sql .pgsql .psql   format syntax style structure naming prose spelling
migrations/*.sql    the above, plus migration safety under database:postgres
```

## Totality

The failure this preset exists to prevent, in detail, because it is the single best argument for the
coverage check:

```text
supabase/.sqlfluffignore:9   sql/
```

In gitignore semantics that pattern matches any directory named `sql` at any depth. The repository
has `tests/suites/sql/` and `src/remote/teardown/sql/`, both of which the pre-commit command names
explicitly as paths to lint. Verified live in the reference audit: linting
`tests/suites/sql/rls/versioning.test.sql` prints "ignored by an ignore pattern". Two more files,
`src/remote/ops/cron/user-deletion.sql` and `ops/vault-secrets/set-secret.sql`, are in no path list
at all. Total: 25 of 83 files linted, and the configuration reads as though all of them are.

Three gspot mechanisms catch it independently:

1. **Path selectors are not gitignore.** A bare `sql/` fails to parse, with the message naming this
   exact failure.
1. **The files a check reads asks sqlfluff.** `sqlfluff lint --nofail` over the candidate set reports which files
   it ignored, and the coverage check attributes no claim to them.
1. **Full coverage per language.** 58 unchecked `.sql` files fail the gate with the list.

Other habits:

| Habit                                                    | Reference evidence                                                                                                    | gspot                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Tests written in SQL are not source                      | `tests/suites/sql/**` ignored                                                                                         | Claimed, with the required kinds relaxed for style rules that fight pgTAP idiom          |
| Teardown and ops scripts are not source                  | Two files in no path list                                                                                             | Claimed                                                                           |
| Applied migrations are immutable, so they are not linted | The reference branch edited sixteen applied migrations to satisfy two Squawk rules, against the repository's own rule | `[sql.migrations] immutable_through`, below. One setting, asked once, no default. |

That last row is the important one. The reference branch inserted `SET lock_timeout` and
`SET statement_timeout` into sixteen already-applied migration files to satisfy
`require-lock-timeout` and `require-statement-timeout`, which broke immutability and left the remote
having run different text from what a fresh environment will run. Worse, a non-`LOCAL`
`SET statement_timeout` persists for the session into nine large insert migrations that received no
guard.

The preset's model:

```toml
[sql.migrations]
immutable_through = "20260415175157"
```

Everything at or before that version is exempt from the safety rules and covered by everything else.
Everything after it gets the full set. `squawk --exclude-path` implements it, and the baseline is a
tracked fact with a comment explaining when it was set.

## Migration immutability: one setting

Immutability is not a property of a file. It is a statement about whether a migration has run
somewhere you cannot rebuild. A pre-launch project resets production. A project with a squash
workflow rewrites history on purpose. A dev-only database has nothing immutable at all. So gspot
cannot infer this, and guessing is how the reference branch ended up editing sixteen shipped
migrations.

**One key. Three value shapes. No second key, no conditional.**

```toml
[sql.migrations]
immutable_through = "none"              # nothing is frozen
immutable_through = "all"               # every migration that exists now is frozen
immutable_through = "20260415175157"    # this version and earlier are frozen
```

`gspot init` asks once and writes the answer. There is **no default**, because every default is
wrong for somebody: `"none"` lets `gspot fix` reformat shipped SQL, and `"all"` stops a pre-launch
project from ever linting a migration. `gspot init` proposes the newest migration on the default
branch, because that one is most likely deployed, and a proposal is a proposal.

### What frozen means

|                                                        | Frozen    | Not frozen     |
| ------------------------------------------------------ | --------- | -------------- |
| `secrets`                                              | yes       | yes            |
| `immutability`: bytes match the commit that froze them | yes       | not applicable |
| `format`, `style`, `naming`, `structure`, `prose`      | **no**    | yes            |
| Migration safety: `squawk`                             | **no**    | yes            |
| `gspot fix` may write to it                            | **never** | yes            |

The last row matters most. A reporting-only freeze would leave `sqlfluff format` free to rewrite
shipped SQL on the next `gspot fix`, which is worse than any finding it could produce. Frozen is
enforced at the fixer, not only at the reporter.

### Why it is two states and not three

The tempting third state is "report, do not fail, do not fix". That is a warning level, and there is
no warning level. The reasoning is short:

- If the reader may edit the file, it is not frozen, and the full gate applies.
- If the reader may not edit the file, a finding is noise, and noise teaches people to skim.

Moving the boundary is one edit to one value, visible in review. That is the only way out, and it is
enough: a project that finds a supposedly shipped migration was never shipped moves the version down
by one line.

### Why a version and not a list of files

A per-file `[[declare]]` with `kind = "frozen"` would work, and it is the wrong shape here.
Migrations are ordered by version, freezing is monotonic, and a boundary is one fact where a list is
dozens that go stale. So `immutable_through` expands into those declarations internally, and the
coverage check sees frozen migrations exactly as it sees any other declared file. The general
`[[declare]]` table still accepts `kind = "frozen"` for one-off files outside a migration directory.
