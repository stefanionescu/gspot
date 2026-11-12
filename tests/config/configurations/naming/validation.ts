export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.exception]]\npaths = [".mise/tasks/*.sh"]\n' +
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

export const OVERLONG_NAME_FINDINGS = [
    { rule: 'digits', message: `typescript function "helperValue2UserUserWithMoreWordsHere": a digit is not a word.` },
    {
        rule: 'length',
        message: `typescript function "helperValue2UserUserWithMoreWordsHere": 37 characters is over the limit of 35.`,
    },
    {
        rule: 'words',
        message: `typescript function "helperValue2UserUserWithMoreWordsHere": 8 words is over the limit of 4.`,
    },
    {
        rule: 'duplicate-words',
        message: `typescript function "helperValue2UserUserWithMoreWordsHere": "user" repeats.`,
    },
    {
        rule: 'banned-word',
        message: `typescript function "helperValue2UserUserWithMoreWordsHere": "helper" is banned (roles list).`,
    },
] as const;
