export const FRAMEWORK_NAMES = [
    { configuration: 'nextjs', name: 'getServerSideProps', bannedWords: ['get server side props'] },
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

export const TEST_PATH_FILES = {
    'qa/entry.js': 'export const testcaseCount = 1;\n',
    '__tests__/default.js': 'export const testcaseCount = 1;\n',
    'src/entry.js': 'export const testcaseCount = 1;\n',
    'Tests/Service.swift': 'let testcaseCount = 1\n',
    'Sources/ServiceTests.swift': 'let testcaseCount = 1\n',
    'Sources/Service.swift': 'let testcaseCount = 1\n',
    'apps/web/verification/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/qa/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/src/entry.js': 'export const testcaseCount = 1;\n',
    'apps/api/verification/entry.js': 'export const testcaseCount = 1;\n',
} as const;

export const REACT_COMPONENT_SOURCE = [
    "import { createContext, memo } from 'react';",
    "import styled from 'styled-components';",
    'export const CartContext = createContext(null);',
    'export const Row = memo(() => null);',
    'export const Title = styled.h1`font-weight: bold;`;',
    'export const BadValue = readValue();',
    'const { user_name, account: bad_account } = payload;',
    'export const names = [user_name, bad_account];',
    '',
] as const;

export const PYTHON_TYPE_SOURCE = [
    'from typing import Literal, Optional, TypeAlias',
    'Mode = Literal["read", "write"]',
    'ModeChoice = Optional[Mode] | None',
    'Reading: TypeAlias = "Reader"',
    '_Private = dict[str, int]',
    'READ_FLAG = 1',
    'ACCESS_FLAGS = READ_FLAG | 2',
    'class Reader:',
    '    def __init_subclass__(cls):',
    '        pass',
    '    def __rich_repr__(self):',
    '        pass',
    'badAlias = Literal["x"]',
    '',
] as const;

export const TEST_FILE_FINDINGS = [
    { file: 'Sources/Service.swift', rule: 'banned-word' },
    { file: 'Sources/ServiceTests.swift', rule: 'banned-word' },
    { file: 'Tests/Service.swift', rule: 'banned-word' },
    { file: '__tests__/default.js', rule: 'banned-word' },
    { file: 'src/entry.js', rule: 'banned-word' },
    { file: 'apps/api/verification/entry.js', rule: 'banned-word' },
    { file: 'apps/web/qa/entry.js', rule: 'banned-word' },
    { file: 'apps/web/src/entry.js', rule: 'banned-word' },
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

export const SQL_SOURCE_NAMES: (string | number)[][] = [
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

export const NEXTJS_FOLDER_NAMES = [
    'folders:app',
    'folders:marketing',
    'path_parameters:slug',
    'folders:modal',
    'folders:lib',
] as const;

export const NUMBERED_FILE_FINDINGS = [
    { file: '.mise/tasks/01-build.sh', rule: 'case' },
    { file: '.mise/tasks/01-build.sh', rule: 'digits' },
    { file: 'scripts/steps/01-build.sh', rule: 'case' },
    { file: 'scripts/steps/01-build.sh', rule: 'digits' },
] as const;

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

export const NAME_WORD_CASES = [
    ['HTMLParser', ['html', 'parser']],
    ['user_id', ['user', 'id']],
    ['parseHttpUrl', ['parse', 'http', 'url']],
    ['edge-case.test', ['edge', 'case', 'test']],
    ['handlerV2', ['handler', 'v', '2']],
    ['user2', ['user', '2']],
    ['decodeBase64', ['decode', 'base64']],
    ['s3Client', ['s3', 'client']],
    ['I18N', ['i18n']],
    ['sha256_user', ['sha256', 'user']],
] as const;
