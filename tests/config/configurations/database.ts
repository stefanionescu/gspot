export const DEFINER_FUNCTION_SQL =
    'CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n';

export const DEFINER_REPAIRS = [
    {
        name: 'replacement',
        sql: "CREATE OR REPLACE FUNCTION public.grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
    },
    { name: 'removal', sql: 'DROP FUNCTION public.grant_access();\n' },
] as const;

export const SECURITY_ALTERATIONS = [
    { change: 'SECURITY DEFINER', initial: '', unsafe: true },
    { change: 'SECURITY INVOKER', initial: 'SECURITY DEFINER', unsafe: false },
    { change: 'RESET search_path', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
    { change: 'RESET ALL', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
] as const;

export const COMPOSITE_INDEX_CASES = [
    { columns: 'tenant_id, user_id', count: 0 },
    { columns: 'user_id, tenant_id, id', count: 0 },
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

const EQUIVALENT_INDEXES_SQL = `
        CREATE TABLE posts (author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX first ON posts(author_id);
        CREATE INDEX second ON posts(author_id);
        DROP INDEX first;
    `;

const DROPPED_CONSTRAINTS_SQL = `
        CREATE TABLE posts (author_id int, team_id int,
            CONSTRAINT author_fk FOREIGN KEY(author_id) REFERENCES users(id),
            CONSTRAINT team_fk FOREIGN KEY(team_id) REFERENCES teams(id),
            CONSTRAINT author_unique UNIQUE(author_id));
        CREATE INDEX author_index ON posts(author_id);
        ALTER TABLE posts DROP CONSTRAINT author_fk, DROP CONSTRAINT author_unique;
    `;

const UNNAMED_KEYS_SQL =
    'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));';

const ADDED_COLUMN_SQL =
    'CREATE TABLE posts (id int); ALTER TABLE posts ADD COLUMN user_id int REFERENCES users(id); CREATE INDEX post_users ON posts(user_id);';

export const DATABASE_SCHEMA_CASES = [
    {
        name: 'table and column renames retain their foreign keys, indexes, and row security',
        migrations: [
            `CREATE TABLE teams (tenant_id int, user_id int, FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id));
CREATE INDEX teams_lookup ON teams (tenant_id, user_id);
ALTER TABLE teams RENAME TO groups;
ALTER TABLE groups RENAME COLUMN tenant_id TO organization_id;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
`,
        ],
        schema: {
            tables: ['public.groups'],
            secured: ['public.groups'],
            foreignKeys: ['public.groups (organization_id, user_id)'],
            indexed: [['public.groups', [['organization_id', 'user_id']]]],
        },
    },
    {
        name: 'keys count as indexes, a table constraint names its columns, and a dropped table leaves',
        migrations: [
            'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));',
            'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;',
        ],
        schema: {
            tables: ['public.posts'],
            secured: [],
            foreignKeys: ['public.posts (author_id)', 'public.posts (team_id)'],
            indexed: [['public.posts', [['id'], ['author_id', 'id']]]],
        },
    },
    {
        name: 'table recreation discards security, keys, and indexes from the old table',
        migrations: [
            `
        CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX authors ON posts(author_id);
        DROP TABLE posts;
        CREATE TABLE posts (id int, author_id int REFERENCES users(id));
    `,
        ],
        schema: { tables: ['public.posts'], secured: [], foreignKeys: ['public.posts (author_id)'], indexed: [] },
    },
    {
        name: 'removing one of two equivalent indexes preserves the other',
        migrations: [EQUIVALENT_INDEXES_SQL],
        schema: {
            tables: ['public.posts'],
            secured: ['public.posts'],
            foreignKeys: ['public.posts (author_id)'],
            indexed: [['public.posts', [['author_id']]]],
        },
    },
    {
        name: 'removing the second equivalent index removes the index, and disabling row security removes it',
        migrations: [EQUIVALENT_INDEXES_SQL, 'DROP INDEX second;\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;\n'],
        schema: { tables: ['public.posts'], secured: [], foreignKeys: ['public.posts (author_id)'], indexed: [] },
    },
    {
        name: 'dropped foreign and unique constraints remove only the fields they own',
        migrations: [DROPPED_CONSTRAINTS_SQL],
        schema: {
            tables: ['public.posts'],
            secured: [],
            foreignKeys: ['public.posts (team_id)'],
            indexed: [['public.posts', [['author_id']]]],
        },
    },
    {
        name: 'an index dropped after its unique constraint leaves no index',
        migrations: [DROPPED_CONSTRAINTS_SQL, 'DROP INDEX author_index;'],
        schema: { tables: ['public.posts'], secured: [], foreignKeys: ['public.posts (team_id)'], indexed: [] },
    },
    {
        name: 'an unnamed foreign key does not count as an index',
        migrations: [UNNAMED_KEYS_SQL],
        schema: {
            tables: ['public.posts'],
            secured: [],
            foreignKeys: ['public.posts (author_id)'],
            indexed: [['public.posts', [['id'], ['title']]]],
        },
    },
    {
        name: 'an unnamed foreign key is dropped by the PostgreSQL default name',
        migrations: [UNNAMED_KEYS_SQL, 'ALTER TABLE posts DROP CONSTRAINT posts_author_id_fkey;'],
        schema: {
            tables: ['public.posts'],
            secured: [],
            foreignKeys: [],
            indexed: [['public.posts', [['id'], ['title']]]],
        },
    },
    {
        name: 'a column addition adds its foreign key and index',
        migrations: [ADDED_COLUMN_SQL],
        schema: {
            tables: ['public.posts'],
            secured: [],
            foreignKeys: ['public.posts (user_id)'],
            indexed: [['public.posts', [['user_id']]]],
        },
    },
    {
        name: 'a column removal removes its foreign key and index',
        migrations: [ADDED_COLUMN_SQL, 'ALTER TABLE posts DROP COLUMN user_id;'],
        schema: { tables: ['public.posts'], secured: [], foreignKeys: [], indexed: [] },
    },
    {
        name: 'renamed constraints and indexes can be dropped by their new names',
        migrations: [
            'CREATE TABLE posts (id int, user_id int, CONSTRAINT user_fk FOREIGN KEY(user_id) REFERENCES users(id)); CREATE INDEX user_idx ON posts(user_id); ALTER TABLE posts RENAME CONSTRAINT user_fk TO renamed_fk; ALTER INDEX user_idx RENAME TO renamed_idx; ALTER TABLE posts DROP CONSTRAINT renamed_fk; DROP INDEX renamed_idx;',
        ],
        schema: { tables: ['public.posts'], secured: [], foreignKeys: [], indexed: [] },
    },
    {
        name: 'partial indexes do not cover foreign keys, and schema changes retain security and index ownership',
        migrations: [
            'CREATE TABLE posts (id int, user_id int REFERENCES users(id)); CREATE INDEX partial_users ON posts(user_id) WHERE user_id > 0; ALTER TABLE posts ENABLE ROW LEVEL SECURITY; ALTER TABLE posts SET SCHEMA client;',
        ],
        schema: {
            tables: ['client.posts'],
            secured: ['client.posts'],
            foreignKeys: ['client.posts (user_id)'],
            indexed: [],
        },
    },
] as const;

export const ROW_SECURITY_SQL = 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;';

export const NAME_COLUMN_SQL = 'ALTER TABLE teams ADD COLUMN name text;\n';

export const CHILD_POSTGRES_SCOPE_TABLES = `[[scope]]
path = "app"

configurations = ["postgres"]
[scope.postgres]
frozen_through = "2"
`;

export const CHILD_MIGRATIONS = {
    'migrations/V1_root.sql': 'SELECT 1;\n',
    'app/migrations/V2_first.sql': 'SELECT 2;\n',
    'app/migrations/V10_next.sql': 'SELECT 10;\n',
    'other/migrations/V1_other.sql': 'SELECT 1;\n',
} as const;

export const SQUAWK_MIGRATION_FILES = {
    'migrations/2_initial.sql': 'SELECT 1;\n',
    'migrations/10_next.sql': 'SELECT 1;\n',
    'migrations/9007199254740992_large.sql': 'SELECT 1;\n',
    'migrations/9007199254740993_later.sql': 'SELECT 1;\n',
    'migrations/V2_initial.sql': 'SELECT 1;\n',
} as const;

export const SQUAWK_VERSION_CASES = [
    ['2', ['migrations/2_initial.sql', 'migrations/V2_initial.sql']],
    [
        '9007199254740992',
        [
            'migrations/10_next.sql',
            'migrations/2_initial.sql',
            'migrations/9007199254740992_large.sql',
            'migrations/V2_initial.sql',
        ],
    ],
    [
        'all',
        [
            'migrations/10_next.sql',
            'migrations/2_initial.sql',
            'migrations/9007199254740992_large.sql',
            'migrations/9007199254740993_later.sql',
            'migrations/V2_initial.sql',
        ],
    ],
] as const;
