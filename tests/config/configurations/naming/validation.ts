export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.override]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    String.raw`categories = ["files"]
ignored_prefix = '^\d{2}-'
reason = "The project orders its tasks by this prefix."
`;

const NEXT_PAGE_SOURCE = 'export default function Page() { return null; }\n';

export const FILE_NAME_CASES = [
    {
        name: '__init__.ts is reported; Python __init__.py and __main__.py are allowed',
        configurations: ['python', 'typescript', 'naming'],
        files: {
            'python/__init__.py': '"""Package entry."""\n',
            'python/__main__.py': '"""Program entry."""\n',
            'javascript/__init__.ts': 'export const entry = 1;\n',
        },
        invalid: 'javascript/__init__.ts',
        renamed: 'javascript/entry.ts',
    },
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
            'pages/_document.tsx': NEXT_PAGE_SOURCE,
            'pages/_error.tsx': NEXT_PAGE_SOURCE,
            'pages/404.tsx': NEXT_PAGE_SOURCE,
            'pages/500.tsx': NEXT_PAGE_SOURCE,
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
            '.claude/entry.ts': 'export const entry = 1;\n',
            '.vscode/entry.ts': 'export const entry = 1;\n',
        },
        invalid: '.archive/bad_name.ts',
        renamed: '.archive/bad-name.ts',
    },
] as const;

export const NUMBERED_FILE_FINDINGS = [
    { file: '.mise/tasks/01-build.sh', rule: 'case' },
    { file: '.mise/tasks/01-build.sh', rule: 'digits' },
    { file: 'scripts/steps/01-build.sh', rule: 'case' },
    { file: 'scripts/steps/01-build.sh', rule: 'digits' },
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
    label: 'function',
    name: 'handleLogin',
} as const;

export const HOOK_PREFIX_TABLES = `[naming]
banned_words = ["handle", "use"]
[[naming.override]]
paths = ["src/hooks/**"]
categories = ["functions"]
ignored_prefix = "^use(?=[A-Z])"
reason = "A hook starts with use."
`;

export const ALLOWED_NAME_TABLES = `[[naming.override]]
paths = ["**"]
allowed_names = ["requestAnimationFrame"]
reason = "The browser API names it."
[[naming.override]]
paths = ["api/route.ts"]
allowed_names = ["Content-Type"]
reason = "The HTTP header names it."
`;

export const HANDLE_PREFIX_TABLES = `[naming]
banned_words = ["handle"]
[[naming.override]]
paths = ["src/**"]
languages = ["typescript", "javascript"]
categories = ["functions", "methods"]
ignored_prefix = "^handle(?=[A-Z])"
reason = "Event handlers start with handle."
`;

export const OVERLONG_NAME_FINDINGS = [
    { rule: 'digits', message: `typescript functions "helperValue2UserUserWithMoreWordsHere": a digit is not a word.` },
    {
        rule: 'length',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": 37 characters is over the limit of 35.`,
    },
    {
        rule: 'words',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": 8 words is over the limit of 4.`,
    },
    {
        rule: 'duplicate-words',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": "user" repeats.`,
    },
    {
        rule: 'banned-word',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": "helper" is banned (roles list).`,
    },
] as const;

export const LINTER_LIMIT_CASES = [
    {
        language: 'swift',
        category: 'types',
        expected: [],
        wordy: [
            {
                rule: 'words',
                message: 'types "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 5.',
            },
        ],
    },
    {
        language: 'swift',
        category: 'functions',
        expected: [
            {
                rule: 'case',
                message: 'functions "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": expected upper-snake case.',
            },
            {
                rule: 'length',
                message:
                    'functions "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 41 characters is over the limit of 40.',
            },
        ],
        wordy: [
            {
                rule: 'case',
                message: 'functions "one_two_three_four_five_six_seven_eight": expected upper-snake case.',
            },
            {
                rule: 'words',
                message: 'functions "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 5.',
            },
        ],
    },
    {
        language: 'python',
        category: 'classes',
        expected: [
            {
                rule: 'length',
                message: 'classes "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 41 characters is over the limit of 35.',
            },
        ],
        wordy: [
            {
                rule: 'length',
                message: 'classes "one_two_three_four_five_six_seven_eight": 39 characters is over the limit of 35.',
            },
            {
                rule: 'words',
                message: 'classes "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 4.',
            },
        ],
    },
] as const;
