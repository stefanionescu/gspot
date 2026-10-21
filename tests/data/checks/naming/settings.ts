/** A web scope and a worker scope that each fix one external name. */
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
        unusedNames: [],
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
        unusedNames: ['commentName', 'missingFile'],
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
        unusedNames: ['siblingName'],
    },
    {
        name: 'each scope keeps the allowance that its own source uses',
        files: ALLOWED_NAME_FILES,
        settings: ALLOWED_NAME_LAYOUT,
        unusedNames: [],
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
        unusedNames: ['remoteRecord'],
    },
    {
        name: 'a renamed source leaves both of its allowances unused',
        files: { ...ALLOWED_NAME_FILES, 'web/source.js': 'export const localRecord = 1;\n' },
        settings: ALLOWED_NAME_LAYOUT,
        unusedNames: ['remoteRecord', 'remoteRecord'],
    },
] as const;

export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export const SCOPE_LIMITS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
] as const;

export const NAMING_LANGUAGES = ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'] as const;

/** Expected naming findings where the language linter owns some of the naming rules. */
export const LINTER_LIMIT_CASES = [
    { language: 'swift', category: 'types', expected: [] },
    { language: 'swift', category: 'functions', expected: ['case', 'length'] },
    { language: 'python', category: 'classes', expected: ['length'] },
    { language: 'python', category: 'exceptions', expected: ['length'] },
] as const;

export const FRAMEWORK_NAMES = [
    { configuration: 'nextjs', name: 'getServerSideProps', bannedWords: ['get server side props'] },
    { configuration: 'react', name: 'useSyncExternalStore', bannedWords: ['use sync external store'] },
] as const;

export const TEST_PATH_SETTINGS = `level = "all"
configurations = ["javascript", "swift", "naming"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"
test_files = ["apps/web/verification/**"]
[[scope]]
path = "apps/api"
`;

export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.override]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    String.raw`categories = ["files"]
ignored_prefix = '^\d{2}-'
reason = "The project orders its tasks by this prefix."
`;

export const SWIFT_NAMING_LIMITS =
    `[naming.swift]
max_characters = 38
max_words = 4
[naming.swift.functions]
max_characters = 37
` +
    `[[scope]]
path = "app"
[scope.naming.swift]
max_characters = 36
max_words = 3
` +
    `[scope.naming.swift.functions]
max_characters = 35
[[scope]]
path = "sibling"
`;

export const UPPER_SNAKE_OVERRIDE = `[[naming.override]]
paths = ["source"]
cases = ["upper-snake"]
reason = "The authored interface selects this case."
`;

export const BANNED_WORDS = [
    { word: 'common', parts: ['common'], setting: 'test' },
    { word: 'edge case', parts: ['edge', 'case'], setting: 'test' },
    { word: 'load-bearing', parts: ['load', 'bearing'], setting: 'test' },
];

export const NAMING_TEST_SETTINGS = {
    allowedPhrases: [['package', 'manager']],
    bannedWords: [
        { word: 'enhanced', parts: ['enhanced'], setting: 'marketing group', group: 'marketing' },
        { word: 'handler', parts: ['handler'], setting: 'marketing group', group: 'marketing' },
    ],
    reserved: new Map([['config', ['folders', 'variables']]]),
    overrides: [
        {
            matches: ['**'],
            languages: undefined,
            categories: undefined,
            allowedNames: new Set(['requestAnimationFrame', 'enhancedThing']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            ignoredPrefix: undefined,
            ignoredNames: undefined,
            cases: undefined,
        },
        {
            matches: ['api/route.ts'],
            languages: undefined,
            categories: undefined,
            allowedNames: new Set(['Content-Type']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            ignoredPrefix: undefined,
            ignoredNames: undefined,
            cases: undefined,
        },
        {
            matches: ['**'],
            languages: undefined,
            categories: new Set(['variables']),
            allowedNames: new Set(['i', '_']),
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            ignoredPrefix: undefined,
            ignoredNames: undefined,
            cases: undefined,
        },
        {
            matches: ['**/acceptance/**'],
            languages: undefined,
            categories: undefined,
            allowedNames: undefined,
            isDigitsAllowed: true,
            isRepeatAllowed: false,
            ignoredPrefix: undefined,
            ignoredNames: undefined,
            cases: undefined,
        },
        {
            matches: ['**/*.sh'],
            languages: new Set(['bash']),
            categories: new Set(['functions']),
            allowedNames: undefined,
            isDigitsAllowed: false,
            isRepeatAllowed: false,
            ignoredPrefix: /^_+/u,
            ignoredNames: undefined,
            cases: undefined,
        },
    ],
    isDigitsAllowed: false,
    isRepeatAllowed: false,
};
export const NAMING_TEST_LIMITS = {
    maxChars: 20,
    maxWords: 3,
    types: ['pascal'],
    bash: ['snake'],
    other: ['camel'],
} as const;
