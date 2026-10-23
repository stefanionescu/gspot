import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

/** A migration in each default folder, a rollback, and two in folders that only a setting selects. */
export const DEFAULT_MIGRATION_FOLDER_FILES = {
    'supabase/migrations/1_first.sql': 'CREATE TABLE first_table(id int);',
    'db/migrations/2_second.sql': 'CREATE TABLE second_table(id int);',
    'migrations/3_third.sql': 'CREATE TABLE third_table(id int);',
    'migrations/4_rollback.down.sql': 'invalid SQL;',
    'custom/5_custom.sql': 'CREATE TABLE custom_table(id int);',
    'custom_extra/6_ignored.sql': 'invalid SQL;',
} as const;

/** The migration that does not parse. */
export const MALFORMED_MIGRATION_PATH = 'migrations/20240201_teams.sql';

/** The parsed version of that migration, with row level security on. */
export const SECURED_TEAMS_SQL =
    'CREATE TABLE teams (id integer PRIMARY KEY);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\n';

/** A frozen repository whose one migration does not parse. */
export const MALFORMED_MIGRATION_FILES = {
    'gspot.toml': buildSandboxSettings(['postgres'], {
        level: 'all',
        tables: '[postgres]\nfrozen_through = "all"\n',
    }),
    [MALFORMED_MIGRATION_PATH]: 'CREATE TABLE ;',
};

/** The PostgreSQL checks that run on the migrations. */
export const POSTGRES_CHECKS = [
    'postgres/migration-order',
    'postgres/edited-migrations',
    'postgres/row-level-security',
    'postgres/grants',
    'postgres/definer-search-path',
    'postgres/foreign-key-indexes',
] as const;
