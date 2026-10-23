/** Posts with an inline and a named foreign key, and drafts that reference posts. */
export const KEYED_TABLES_SQL =
    'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));';

/** An index on posts.author_id, and the drop of drafts. */
export const INDEXED_TABLE_DROP_SQL = 'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;';

/** A posts table with row security and an index, which a later migration drops and creates again. */
export const RECREATED_TABLE_SQL = `
        CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX authors ON posts(author_id);
        DROP TABLE posts;
        CREATE TABLE posts (id int, author_id int REFERENCES users(id));
    `;

/** Two indexes on posts.author_id; a later migration drops the first. */
export const EQUIVALENT_INDEXES_SQL = `
        CREATE TABLE posts (author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX first ON posts(author_id);
        CREATE INDEX second ON posts(author_id);
        DROP INDEX first;
    `;

/** Named foreign and unique constraints; a later migration drops two of them. */
export const DROPPED_CONSTRAINTS_SQL = `
        CREATE TABLE posts (author_id int, team_id int,
            CONSTRAINT author_fk FOREIGN KEY(author_id) REFERENCES users(id),
            CONSTRAINT team_fk FOREIGN KEY(team_id) REFERENCES teams(id),
            CONSTRAINT author_unique UNIQUE(author_id));
        CREATE INDEX author_index ON posts(author_id);
        ALTER TABLE posts DROP CONSTRAINT author_fk, DROP CONSTRAINT author_unique;
    `;

/** A foreign key without a name, a unique column, and a check constraint. */
export const UNNAMED_FOREIGN_KEY_SQL =
    'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));';

/** Drops the second index and turns off row level security. */
export const DROP_SECOND_INDEX_SQL = 'DROP INDEX second;\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;\n';
