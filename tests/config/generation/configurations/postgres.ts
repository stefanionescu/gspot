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

/** Migrations with small and large versions. */
export const SQUAWK_MIGRATION_FILES = {
    'migrations/2_initial.sql': 'SELECT 1;\n',
    'migrations/10_next.sql': 'SELECT 1;\n',
    'migrations/9007199254740992_large.sql': 'SELECT 1;\n',
    'migrations/9007199254740993_later.sql': 'SELECT 1;\n',
    'migrations/V2_initial.sql': 'SELECT 1;\n',
    'migrations/V9007199254740992_large.sql': 'SELECT 1;\n',
    'migrations/V9007199254740993_later.sql': 'SELECT 1;\n',
} as const;

/** Each migration version with the paths Squawk skips through it. */
export const SQUAWK_VERSION_CASES = [
    ['2', ['migrations/2_initial.sql', 'migrations/V2_initial.sql']],
    [
        '9007199254740992',
        [
            'migrations/10_next.sql',
            'migrations/2_initial.sql',
            'migrations/9007199254740992_large.sql',
            'migrations/V2_initial.sql',
            'migrations/V9007199254740992_large.sql',
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
            'migrations/V9007199254740992_large.sql',
            'migrations/V9007199254740993_later.sql',
        ],
    ],
] as const;
