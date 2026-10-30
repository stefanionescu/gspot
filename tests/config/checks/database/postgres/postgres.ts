export const DEFINER_FUNCTION_SQL =
    'CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n';

export const DEFINER_REPAIRS = [
    {
        name: 'replacement',
        sql: "CREATE OR REPLACE FUNCTION public.grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
    },
    { name: 'alteration', sql: "ALTER FUNCTION public.grant_access() SET search_path = '';\n" },
    { name: 'removal', sql: 'DROP FUNCTION public.grant_access();\n' },
] as const;

export const SECURITY_ALTERATIONS = [
    { change: 'SECURITY DEFINER', initial: '', unsafe: true },
    { change: 'SECURITY INVOKER', initial: 'SECURITY DEFINER', unsafe: false },
    { change: 'RESET search_path', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
    { change: 'RESET ALL', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
    { change: "SET search_path = ''", initial: 'SECURITY DEFINER', unsafe: false },
] as const;

export const COMPOSITE_INDEX_CASES = [
    { columns: 'tenant_id, user_id', count: 0 },
    { columns: 'user_id, tenant_id, id', count: 0 },
    { columns: 'tenant_id', count: 1 },
    { columns: 'id, tenant_id, user_id', count: 1 },
] as const;

export const DEFAULT_MIGRATION_FOLDER_FILES = {
    'supabase/migrations/1_first.sql': 'CREATE TABLE first_table(id int);',
    'db/migrations/2_second.sql': 'CREATE TABLE second_table(id int);',
    'migrations/3_third.sql': 'CREATE TABLE third_table(id int);',
    'migrations/4_rollback.down.sql': 'invalid SQL;',
    'custom/5_custom.sql': 'CREATE TABLE custom_table(id int);',
    'custom_extra/6_ignored.sql': 'invalid SQL;',
} as const;

export const POSTGRES_CHECKS = [
    'postgres/migration-order',
    'postgres/edited-migrations',
    'postgres/row-level-security',
    'postgres/grants',
    'postgres/definer-search-path',
    'postgres/foreign-key-indexes',
] as const;

export const MALFORMED_MIGRATION_PATH = 'migrations/20240201_teams.sql';

export const RECREATED_TABLE_SQL = `
        CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX authors ON posts(author_id);
        DROP TABLE posts;
        CREATE TABLE posts (id int, author_id int REFERENCES users(id));
    `;

export const EQUIVALENT_INDEXES_SQL = `
        CREATE TABLE posts (author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX first ON posts(author_id);
        CREATE INDEX second ON posts(author_id);
        DROP INDEX first;
    `;

export const DROPPED_CONSTRAINTS_SQL = `
        CREATE TABLE posts (author_id int, team_id int,
            CONSTRAINT author_fk FOREIGN KEY(author_id) REFERENCES users(id),
            CONSTRAINT team_fk FOREIGN KEY(team_id) REFERENCES teams(id),
            CONSTRAINT author_unique UNIQUE(author_id));
        CREATE INDEX author_index ON posts(author_id);
        ALTER TABLE posts DROP CONSTRAINT author_fk, DROP CONSTRAINT author_unique;
    `;

export const RENAMED_TABLE_SQL = `CREATE TABLE teams (tenant_id int, user_id int, FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id));
CREATE INDEX teams_lookup ON teams (tenant_id, user_id);
ALTER TABLE teams RENAME TO groups;
ALTER TABLE groups RENAME COLUMN tenant_id TO organization_id;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
`;
