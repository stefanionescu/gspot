export const CHILD_POSTGRES_POLICY =
    '[scope."app"]\nconfigurations = ["postgres"]\n[scope."app".postgres]\nfrozen_through = "2"\n';

export const CHILD_MIGRATIONS = {
    'migrations/V1_root.sql': 'SELECT 1;\n',
    'app/migrations/V2_first.sql': 'SELECT 2;\n',
    'app/migrations/V10_next.sql': 'SELECT 10;\n',
    'other/migrations/V1_other.sql': 'SELECT 1;\n',
};
