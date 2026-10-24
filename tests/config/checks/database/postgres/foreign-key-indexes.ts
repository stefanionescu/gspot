export const MEMBER_TABLES_SQL =
    'CREATE TABLE teams (id bigint PRIMARY KEY);\nCREATE TABLE members (id bigint PRIMARY KEY, team_id bigint REFERENCES teams (id));\n';

export const MEMBER_INDEX_SQL = 'CREATE INDEX members_team_id ON members (team_id);\n';

export const COMPOSITE_FOREIGN_KEY_SQL =
    'CREATE TABLE orders (tenant_id int, user_id int, id int, FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id));\n';

export const COMPOSITE_INDEX_CASES = [
    { columns: 'tenant_id, user_id', count: 0 },
    { columns: 'user_id, tenant_id, id', count: 0 },
    { columns: 'tenant_id', count: 1 },
    { columns: 'id, tenant_id, user_id', count: 1 },
    { columns: 'id, tenant_id', count: 1 },
] as const;
