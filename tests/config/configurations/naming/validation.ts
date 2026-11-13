export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.exception]]\npaths = [".mise/tasks/*.sh"]\n' +
    String.raw`categories = ["files"]
ignored_prefix = '^\d{2}-'
reason = "The project orders its tasks by this prefix."
`;

const NEXT_PAGE_SOURCE = 'export default function Page() { return null; }\n';

export const FILE_NAME_CASES = [
    {
        name: 'a SQL migration file name keeps its timestamp and must be snake case',
        configurations: ['sql', 'naming'],
        files: {
            'migrations/20260101120000_CreateUsers.sql': 'CREATE TABLE users (id integer);\n',
            'queries/select_users.sql': 'SELECT id FROM users;\n',
        },
        invalid: 'migrations/20260101120000_CreateUsers.sql',
        renamed: 'migrations/20260101120000_create_users.sql',
    },
    {
        name: 'Next.js special pages such as _app and 404 are allowed; a snake_case page is reported',
        configurations: ['nextjs', 'naming'],
        files: {
            'pages/_app.tsx': NEXT_PAGE_SOURCE,
            'pages/404.tsx': NEXT_PAGE_SOURCE,
            'pages/about_page.ts': 'export const title = "About";\n',
        },
        invalid: 'pages/about_page.ts',
        renamed: 'pages/about-page.ts',
    },
    {
        name: 'files in dot folders still get file-name checks',
        configurations: ['typescript', 'naming'],
        files: {
            '.archive/bad_name.ts': 'export const entry = 1;\n',
        },
        invalid: '.archive/bad_name.ts',
        renamed: '.archive/bad-name.ts',
    },
] as const;

export const NUMBERED_FILE_FINDINGS = [
    { file: '.mise/tasks/01-build.sh', rule: 'case' },
    { file: '.mise/tasks/01-build.sh', rule: 'digits' },
] as const;

export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export const NAMING_LIMIT_CASES = [
    { language: 'typescript', category: 'variables', characters: 21, words: 2 },
    { language: 'python', category: 'variables', characters: 23, words: 3 },
] as const;

export const HANDLE_ROUTE_IDENTIFIER = {
    file: 'src/routes/auth.tsx',
    line: 1,
    column: 1,
    language: 'typescript',
    category: 'functions',
    name: 'handleLogin',
} as const;

export const HOOK_PREFIX_TABLES = `[naming]
banned_words = ["handle", "use"]
[[naming.exception]]
paths = ["src/hooks/**"]
categories = ["functions"]
ignored_prefix = "^use(?=[A-Z])"
reason = "A hook starts with use."
`;

export const ALLOWED_NAME_TABLES = `[[naming.exception]]
paths = ["**"]
allowed_names = ["requestAnimationFrame"]
reason = "The browser API names it."
[[naming.exception]]
paths = ["api/route.ts"]
allowed_names = ["Content-Type"]
reason = "The HTTP header names it."
`;

export const HANDLE_PREFIX_TABLES = `[naming]
banned_words = ["handle"]
[[naming.exception]]
paths = ["src/**"]
languages = ["typescript", "javascript"]
categories = ["functions", "methods"]
ignored_prefix = "^handle(?=[A-Z])"
reason = "Event handlers start with handle."
`;

const ALLOWED_NAME_LAYOUT = {
    configurations: ['naming', 'bash'],
    naming: {
        exception: [
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
                exception: [
                    {
                        categories: ['properties'],
                        allowed_names: ['requestName'],
                        reason: 'The external API fixes this property name.',
                    },
                ],
            },
        },
        unused: [[1, 'requestName']],
    },
    {
        name: 'an allowed stem of an unparsable file counts as used',
        files: { 'brokenName.js': 'export const = ;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                exception: [
                    {
                        categories: ['files'],
                        allowed_names: ['brokenName'],
                        reason: 'The external tool fixes this file name.',
                    },
                ],
            },
        },
        unused: [],
    },
    {
        name: 'a folders allowance matches a folder above the files it holds',
        files: { 'src/legacyName/inner/source.js': 'export const one = 1;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                exception: [
                    {
                        paths: ['src/*'],
                        categories: ['folders'],
                        allowed_names: ['legacyName', 'missingName'],
                        reason: 'The external tool fixes this folder name.',
                    },
                ],
            },
        },
        unused: [[1, 'missingName']],
    },
    {
        name: 'allowances name code or files',
        files: { 'phantomName.js': '// commentName\nexport const keptName = true;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                exception: [
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
        unused: [
            [1, 'commentName'],
            [3, 'missingFile'],
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
                exception: [
                    {
                        paths: ['app/**'],
                        allowed_names: ['keptName', 'siblingName'],
                        reason: 'The app interface fixes these exact names.',
                    },
                ],
            },
            scope: [{ path: 'app' }, { path: 'worker' }],
        },
        unused: [[1, 'siblingName']],
    },
    {
        name: 'each scope keeps the allowance that its own source uses',
        files: ALLOWED_NAME_FILES,
        settings: ALLOWED_NAME_LAYOUT,
        unused: [],
    },
    {
        name: 'an allowance for the name of another language is unused',
        files: ALLOWED_NAME_FILES,
        settings: {
            ...ALLOWED_NAME_LAYOUT,
            naming: {
                exception: [
                    ALLOWED_NAME_LAYOUT.naming.exception[0],
                    ALLOWED_NAME_LAYOUT.naming.exception[1],
                    { ...ALLOWED_NAME_LAYOUT.naming.exception[2], allowed_names: ['remoteRecord'] },
                ],
            },
        },
        unused: [[3, 'remoteRecord']],
    },
    {
        name: 'a renamed source leaves both of its allowances unused',
        files: { ...ALLOWED_NAME_FILES, 'web/source.js': 'export const localRecord = 1;\n' },
        settings: ALLOWED_NAME_LAYOUT,
        unused: [
            [1, 'remoteRecord'],
            [2, 'remoteRecord'],
        ],
    },
] as const;
