export const MEMBER_TABLES_SQL =
    'CREATE TABLE teams (id bigint PRIMARY KEY);\nCREATE TABLE members (id bigint PRIMARY KEY, team_id bigint REFERENCES teams (id));\n';

export const MEMBER_INDEX_SQL = 'CREATE INDEX members_team_id ON members (team_id);\n';
