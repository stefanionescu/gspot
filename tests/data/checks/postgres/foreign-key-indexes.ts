/** A members table whose team_id references teams, without an index on team_id. */
export const MEMBER_TABLES_SQL =
    'CREATE TABLE teams (id bigint PRIMARY KEY);\nCREATE TABLE members (id bigint PRIMARY KEY, team_id bigint REFERENCES teams (id));\n';

/** The index that leads with members.team_id. */
export const MEMBER_INDEX_SQL = 'CREATE INDEX members_team_id ON members (team_id);\n';
