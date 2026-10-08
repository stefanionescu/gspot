export const ACCESS_SCOPES = [
    { level: 'recommended', scope: '' },
    { level: 'recommended', scope: 'app' },
    { level: 'all', scope: '' },
    { level: 'all', scope: 'app' },
] as const;

export const GRANT_FILES = {
    'migrations/V1_before.sql': 'GRANT ALL ON TABLE before_table TO authenticated;\n',
    'migrations/V2_at.sql': 'GRANT ALL ON TABLE at_table TO authenticated;\n',
    'migrations/V3_after.sql': 'GRANT ALL ON TABLE after_table TO authenticated;\n',
};

export const FROZEN_GRANTS = [
    { through: 'none', files: ['migrations/V1_before.sql', 'migrations/V2_at.sql', 'migrations/V3_after.sql'] },
    { through: '2', files: ['migrations/V3_after.sql'] },
    { through: 'all', files: [] },
] as const;

export const RLS_SOURCE =
    'CREATE TABLE private_data (id int);\nCREATE TABLE client_data (id int);\nALTER TABLE client_data ENABLE ROW LEVEL SECURITY;\n';
