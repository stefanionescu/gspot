const ALLOWED_NAME_LAYOUT = {
    configurations: ['naming', 'bash'],
    naming: {
        override: [
            { allowed_names: ['remoteRecord'], reason: 'The external JavaScript interface fixes this name.' },
            {
                paths: ['web/**'],
                allowed_names: ['remoteRecord'],
                reason: 'The external JavaScript interface fixes this name.',
            },
            {
                paths: ['worker/**'],
                allowed_names: ['remote_record'],
                reason: 'The external Python interface fixes this name.',
            },
        ],
    },
    scope: [
        { path: 'web', configurations: ['javascript'] },
        { path: 'worker', configurations: ['python'] },
    ],
} as const;

const ALLOWED_NAME_FILES = {
    'entry.sh': 'echo ready\n',
    'web/source.js': 'export const remoteRecord = 1;\n',
    'worker/source.py': 'remote_record = 1\n',
} as const;

export const UNUSED_NAME_CASES = [
    {
        name: 'a properties record whose name only a function uses is unused',
        files: { 'source.js': 'export function requestName() {}\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        categories: ['properties'],
                        allowed_names: ['requestName'],
                        reason: 'The external API fixes this property name.',
                    },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "requestName", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'an allowed stem of an unparsable file counts as used',
        files: { 'brokenName.js': 'export const = ;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        categories: ['files'],
                        allowed_names: ['brokenName'],
                        reason: 'The external tool fixes this file name.',
                    },
                ],
            },
        },
        messages: [],
    },

    {
        name: 'a files-only allowance names the second file in a folder',
        files: {
            'src/first.js': 'export const one = 1;\n',
            'src/second.js': 'export const two = 2;\n',
        },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['src/**'],
                        categories: ['files'],
                        allowed_names: ['second'],
                        reason: 'The external tool fixes this file name.',
                    },
                ],
            },
        },
        messages: [],
    },
    {
        name: 'a folders allowance matches a folder above the files it holds',
        files: { 'src/legacyName/inner/source.js': 'export const one = 1;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['src/*'],
                        categories: ['folders'],
                        allowed_names: ['legacyName', 'missingName'],
                        reason: 'The external tool fixes this folder name.',
                    },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "missingName", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'allowances name code or files',
        files: { 'phantomName.js': '// commentName\nexport const keptName = true;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['*.js'],
                        allowed_names: ['keptName', 'phantomName', 'commentName'],
                        reason: 'The external API declares these exact names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files', 'variables'],
                        allowed_names: ['phantomName', 'keptName'],
                        reason: 'Exact API names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files'],
                        allowed_names: ['missingFile'],
                        reason: 'The external interface fixes this filename.',
                    },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "commentName", which no identifier under its paths uses.',
            '[[naming.override]] record 3 allowed_names includes "missingFile", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'a sibling declaration cannot satisfy an authored source pattern',
        files: {
            'app/source.js': 'export const keptName = true;\n',
            'worker/source.js': 'export const siblingName = true;\n',
        },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['app/**'],
                        allowed_names: ['keptName', 'siblingName'],
                        reason: 'The app interface fixes these exact names.',
                    },
                ],
            },
            scope: [{ path: 'app' }, { path: 'worker' }],
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "siblingName", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'each scope keeps the allowance that its own source uses',
        files: ALLOWED_NAME_FILES,
        settings: ALLOWED_NAME_LAYOUT,
        messages: [],
    },
    {
        name: 'an allowance for the name of another language is unused',
        files: ALLOWED_NAME_FILES,
        settings: {
            ...ALLOWED_NAME_LAYOUT,
            naming: {
                override: [
                    ALLOWED_NAME_LAYOUT.naming.override[0],
                    ALLOWED_NAME_LAYOUT.naming.override[1],
                    { ...ALLOWED_NAME_LAYOUT.naming.override[2], allowed_names: ['remoteRecord'] },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 3 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'a renamed source leaves both of its allowances unused',
        files: { ...ALLOWED_NAME_FILES, 'web/source.js': 'export const localRecord = 1;\n' },
        settings: ALLOWED_NAME_LAYOUT,
        messages: [
            '[[naming.override]] record 1 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
            '[[naming.override]] record 2 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
        ],
    },
] as const;

export const SQL_DECLARATIONS = `-- Accounts.
CREATE SCHEMA app;

CREATE TABLE app.user_accounts (
    id uuid PRIMARY KEY,
    "displayName" text NOT NULL
);

ALTER TABLE app.user_accounts ADD COLUMN created_at timestamptz;
CREATE INDEX user_accounts_created_idx ON app.user_accounts (created_at);
CREATE FUNCTION app.touch_account(account_id uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
CREATE POLICY owner_reads ON app.user_accounts FOR SELECT USING (true);
CREATE TRIGGER touch_on_write BEFORE UPDATE ON app.user_accounts FOR EACH ROW EXECUTE FUNCTION app.touch_account();
CREATE VIEW app.active_accounts AS SELECT id FROM app.user_accounts;
`;

export const QUALIFIED_FUNCTION_DECLARATION = `CREATE FUNCTION same.same(integer, IN same integer DEFAULT same(1, 2), OUT "out" integer, VARIADIC "variadic" integer[])
RETURNS integer LANGUAGE sql AS $$SELECT same$$;
CREATE FUNCTION named.named() RETURNS TABLE (
    named integer,
    "out" integer
) LANGUAGE sql AS $$SELECT 1, 2$$;
`;

export const QUALIFIED_SQL_NAMES = [
    { category: 'functions', name: 'same', line: 1, column: 22 },
    { category: 'parameters', name: 'same', line: 1, column: 39 },
    { category: 'parameters', name: 'out', line: 1, column: 77 },
    { category: 'parameters', name: 'variadic', line: 1, column: 101 },
    { category: 'functions', name: 'named', line: 3, column: 23 },
    { category: 'parameters', name: 'named', line: 4, column: 5 },
    { category: 'parameters', name: 'out', line: 5, column: 6 },
] as const;

export const SQL_SOURCE_NAMES: Array<Array<string | number>> = [
    ['schemas', 'app', 2],
    ['tables', 'user_accounts', 4],
    ['columns', 'id', 5],
    ['columns', 'displayName', 6],
    ['columns', 'created_at', 9],
    ['indexes', 'user_accounts_created_idx', 10],
    ['functions', 'touch_account', 11],
    ['parameters', 'account_id', 11],
    ['policies', 'owner_reads', 12],
    ['triggers', 'touch_on_write', 13],
    ['tables', 'active_accounts', 14],
];

export const SWIFT_NAMING_LIMITS = `[naming.swift]
max_characters = 38
max_words = 4
[naming.swift.functions]
max_characters = 37
[[scope]]
path = "app"
[scope.naming.swift]
max_characters = 36
max_words = 3
[scope.naming.swift.functions]
max_characters = 35
[[scope]]
path = "sibling"
`;
