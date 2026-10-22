export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.override]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    String.raw`categories = ["files"]
ignored_prefix = '^\d{2}-'
reason = "The project orders its tasks by this prefix."
`;
const NEXT_PAGE_SOURCE = 'export default function Page() { return null; }\n';
export const MIGRATION_FILES = {
    'migrations/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
    'other/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
} as const;
export const NUMBERED_FILES = {
    '.mise/tasks/01-build.sh': 'echo example\n',
    'scripts/steps/01-build.sh': 'echo example\n',
} as const;

/** File names that naming/paths reports, the names it allows beside them, and the rename that fixes each. */
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

/** The folder and path parameter names of the Next.js routes. */
export const NEXTJS_FOLDER_NAMES = [
    'folders:app',
    'folders:marketing',
    'path_parameters:slug',
    'folders:modal',
    'folders:lib',
] as const;

/** The naming findings of numbered file names. */
export const NUMBERED_FILE_FINDINGS = [
    { file: '.mise/tasks/01-build.sh', rule: 'case' },
    { file: '.mise/tasks/01-build.sh', rule: 'digits' },
    { file: 'scripts/steps/01-build.sh', rule: 'case' },
    { file: 'scripts/steps/01-build.sh', rule: 'digits' },
] as const;
