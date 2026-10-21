import { buildSandboxSettings } from '#tests/setup/settings.ts';

export const GRANT_FILES = {
    'migrations/V1_before.sql': 'GRANT ALL ON TABLE before_table TO authenticated;\n',
    'migrations/V2_at.sql': 'GRANT ALL ON TABLE at_table TO authenticated;\n',
    'migrations/V3_after.sql': 'GRANT ALL ON TABLE after_table TO authenticated;\n',
} as const;

export const FROZEN_GRANTS = [
    { through: 'none', files: ['migrations/V1_before.sql', 'migrations/V2_at.sql', 'migrations/V3_after.sql'] },
    { through: '2', files: ['migrations/V3_after.sql'] },
    { through: 'all', files: [] },
] as const;

export const RLS_SOURCE = `CREATE TABLE private_data (id int);
CREATE TABLE client_data (id int);
ALTER TABLE client_data ENABLE ROW LEVEL SECURITY;
`;

export const UNWRAPPED_MIGRATION = `SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE public.teams ADD COLUMN size BIGINT;
`;

export const SQUAWK_ROOT_MIGRATION = 'supabase/migrations/0001_initial.sql';

export const SQUAWK_CHILD_MIGRATION = 'transactional/child/supabase/migrations/0001_initial.sql';

export const SQUAWK_SCOPE_SETTINGS = `[tools.squawk]
assume_in_transaction = false
[[scope]]
path = "transactional"

[scope.tools.squawk]
assume_in_transaction = true
[[scope]]
path = "transactional/child"

`;

export const KEYED_TABLES_SQL =
    'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));';

export const INDEXED_TABLE_DROP_SQL = 'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;';

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

export const UNNAMED_FOREIGN_KEY_SQL =
    'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));';

export const DEFAULT_MIGRATION_FOLDER_FILES = {
    'supabase/migrations/1_first.sql': 'CREATE TABLE first_table(id int);',
    'db/migrations/2_second.sql': 'CREATE TABLE second_table(id int);',
    'migrations/3_third.sql': 'CREATE TABLE third_table(id int);',
    'migrations/4_rollback.down.sql': 'invalid SQL;',
    'custom/5_custom.sql': 'CREATE TABLE custom_table(id int);',
    'custom_extra/6_ignored.sql': 'invalid SQL;',
} as const;

export const TEAMS_MIGRATION = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';

export const MIGRATION_FILE = 'migrations/20240201_teams.sql';

export const MALFORMED_MIGRATION_FILES = {
    'gspot.toml': buildSandboxSettings(['postgres'], {
        level: 'all',
        tables: '[postgres]\nfrozen_through = "all"\n',
    }),
    'migrations/20240201_teams.sql': 'CREATE TABLE ;',
};
