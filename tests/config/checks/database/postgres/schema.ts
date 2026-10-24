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
