import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';

// check plan
export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;

// check skips
const NEXT_INTL_PACKAGE = '{"dependencies":{"next-intl":"4.8.3"}}';
export const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
] as const;

// check tools
const PYTHON_APP_FILES = {
    'app.py': 'value = 1\n',
    'pyproject.toml': `[project]
name = "app"
version = "1.0.0"
`,
} as const;
export const NODE_REQUIREMENTS = [
    {
        name: 'Python with npm schema peers under mise',
        tables: '',
        configurations: ['python'],
        files: PYTHON_APP_FILES,
        needs: ['node', 'ruff'],
        skips: [],
    },
    {
        name: 'Python with only mise tools',
        tables: `${NPM_CHECK_IGNORES}[[ignore]]
check = "python/basedpyright"
reason = "This sandbox exercises Python without the npm type checker."
[[ignore]]
check = "licenses/allowed"
reason = "This sandbox exercises native tools without the license scanner."
`,
        configurations: ['python'],
        files: PYTHON_APP_FILES,
        needs: ['ruff'],
        skips: ['node', 'eslint', 'typescript'],
    },
] as const;

// file selection
export const PROJECT_PATH_IGNORES = [
    {
        name: 'a deleted ignored input',
        changed: ['api/ignored.ts'],
        present: false,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'a changed ignored input',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'an ignored and an owned input',
        changed: ['api/ignored.ts', 'api/kept.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: ['api/kept.ts'],
    },
    {
        name: 'a rule-specific ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: 'sample',
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
    {
        name: 'another check\u{2019}s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'json/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

// file triggers
export const LAST_FILE_CHANGES = [
    ['delete', 'staged'],
    ['rename', 'changed'],
];

// typescript scopes
export const TSC_PUSH_OPTIONS = { stage: 'push' as const, only: ['typescript/tsc'] };
export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;
export const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);
