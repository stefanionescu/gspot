import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';

export const GENERATOR_CASES = [
    { configuration: 'drizzle', check: 'drizzle/stale-migrations', output: 'migrations/0000_initial.sql', tables: '' },
    {
        configuration: 'supabase',
        check: 'supabase/stale-types',
        output: 'database.ts',
        tables: '[supabase]\ntypes_file = "database.ts"\n',
    },
] as const;

export const DATABASE_SCHEMAS = ['public', 'private', 'audit'] as const;

export const SUPABASE_TYPES_OUTPUT = 'export type Database = { public: { Tables: {} } };\n';

export const UNTRACKED_CLOUDFLARE_FINDINGS = [
    {
        file: 'cloudflare-env.d.ts',
        rule: 'untracked',
        message: 'cloudflare-env.d.ts is not tracked. Commit it, so the other checks and this check can read it.',
    },
] as const;

export const MISSING_OPENAPI_FINDINGS = [
    {
        file: 'openapi.json',
        line: 1,
        rule: 'missing',
        message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
    },
] as const;

export const CLOUDFLARE_ENV_SOURCE = 'interface CloudflareEnv {}\n';

export const PROJECT_NOTES = 'Keep project notes\n';

export const UNTRACKED_NOTES = 'Keep untracked notes\n';

export const BINARY_OUTPUT_HEX = '00ff8047454e455241544544';

export const BUN_PROJECT_FILES = {
    'package.json': JSON.stringify({
        name: 'shop',
        private: true,
        dependencies: { zod: '^4.1.0', react: '19.1.0', 'react-dom': '19.0.0' },
        devDependencies: { typescript: '0.0.0-test' },
    }),
    'bun.lock': JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
            '': {
                name: 'shop',
                dependencies: { zod: '^4.0.0', react: '19.1.0', 'react-dom': '19.0.0', 'left-pad': '1.3.0' },
            },
        },
        packages: {
            zod: ['zod@4.0.5', '', {}, 'sha512-a'],
            react: ['react@19.1.0', '', {}, 'sha512-b'],
            'react-dom': ['react-dom@19.0.0', '', {}, 'sha512-c'],
            'left-pad': ['left-pad@1.3.0', '', {}, 'sha512-d'],
        },
    }),
} as const;

export const JSCPD_SCOPE_FINDINGS = [
    {
        file: 'scripts/café.sh',
        line: 3,
        rule: 'clone',
        message: '30 lines repeat scripts/original.sh:7.',
    },
] as const;

export const VALE_ALERT = {
    Line: 1,
    Span: [3, 5],
    Check: 'gspot.Example',
    Message: 'Use a concrete example.',
} as const;

export const VALE_INSTALLED_FILES = Object.fromEntries(
    ['Google', 'write-good', 'proselint', 'alex', 'Harper', 'config/dictionaries'].map((folder) => [
        `${GSPOT_PATHS.valePackages}/${folder}/.keep`,
        '',
    ]),
);

export const VALE_SANDBOX_FILES = {
    ...VALE_INSTALLED_FILES,
    [GSPOT_PATHS.valeConfig]: 'Packages =\n',
    'example.md': '# Documentation\n',
};

export const EMPTY_VALE_INI = 'Packages =\n';

export const LOCAL_FILE_PATHS = {
    indexOnly: ['.env.'],
    refused: [
        '.env',
        '.env.local',
        '.env.example.local',
        'nested/.dev.vars.production',
        'node_modules/.env.example',
        'bower_components/package/index.js',
        'python/.venv/lib/package.py',
        'python/nested/venv/lib/package.py',
        'python/deep/.venv/lib/package.py',
        'swift/Pods/Library/source.swift',
        'swift/DerivedData/output.bin',
        'swift/.build/output.bin',
        'sibling/node_modules/package/index.js',
        'sibling/.dev.vars',
    ],
    allowed: [
        '.env.example',
        '.env.template',
        '.env.sample',
        '.dev.vars.example',
        'nested/.env.example',
        'nested/.env.template',
        'nested/.env.sample',
        'nested/.dev.vars.example',
        'python/node_modules/package/index.js',
        'swift/node_modules/package/index.js',
        'sibling/.venv/lib/package.py',
        '.venv/lib/package.py',
        '.build/output.bin',
        'python/source.py',
    ],
    scopes: `[[scope]]
path = "python"
configurations = ["python"]
removed_configurations = { javascript = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "python/deep"
[[scope]]
path = "swift"
configurations = ["swift"]
removed_configurations = { javascript = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "sibling"
`,
} as const;

export const LARGE_FILE_TABLES = `[[scope]]
path = "app"

[repository]
max_file_kilobytes = 1
`;

export const PYTHON_IMPORT_EXCLUSIONS = [
    { source: 'import os\nimport pathlib as paths\n', expected: '' },
    { source: 'from .package import first as renamed, second\n', expected: '' },
    { source: 'from package import (\n    first as renamed,\n    second,\n)\n', expected: '' },
    { source: 'import first, \\\n    second as renamed\n', expected: '' },
    { source: 'from package import \\\n    (first,\n     second)\n', expected: '' },
    { source: 'import os; calculate_total()\n', expected: '; calculate_total()' },
    {
        source: 'description = "Users import packages to calculate totals"\n',
        expected: 'description = "Users import packages to calculate totals"',
    },
    { source: 'from package import first\ncalculate_total()\n', expected: 'calculate_total()' },
] as const;

export const EDITORCONFIG_SELECTOR_ERRORS = [
    {
        pattern: 'src/*.+(ts|js)',
        message:
            'EditorConfig cannot represent selector "src/*.+(ts|js)". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
] as const;

export const PROSE_STYLE_CASES = [
    {
        name: 'sentence-length',
        expected: { scope: 'sentence', max: 17, message: 'A sentence longer than 17 words. Split it.' },
    },
] as const;

export const BASH_SANDBOX = {
    executable: ['scripts/a.sh', 'scripts/b.sh', 'scripts/build.sh'],
    cleanSource: CLEAN_BASH_SCRIPT,
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;
