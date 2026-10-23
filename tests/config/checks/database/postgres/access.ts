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

export const ROW_SECURITY_SQL = `CREATE TABLE private_data (id int);
CREATE TABLE client_data (id int);
ALTER TABLE client_data ENABLE ROW LEVEL SECURITY;
`;

export const SECURED_ROW_SECURITY_SQL = `${ROW_SECURITY_SQL}ALTER TABLE private_data ENABLE ROW LEVEL SECURITY;\n`;

export const DEFINER_FUNCTION_SQL =
    'CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n';

export const DEFINER_SEARCH_PATH_SQL =
    "CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n";
