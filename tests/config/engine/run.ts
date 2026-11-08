import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';

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

export const COVERAGE_PROVIDERS = [
    { configuration: 'pytest', provider: 'pytest-cov', file: 'test_math.py', configurations: ['python', 'pytest'] },
    {
        configuration: 'vitest',
        provider: '@vitest/coverage-v8',
        file: 'math.test.js',
        configurations: ['javascript', 'vitest'],
    },
] as const;

export const FIX_LINTER_CASES = [
    {
        configuration: 'javascript',
        tool: 'eslint',
        executable: 'eslint.js',
        path: 'sample.js',
        config: 'native.mjs',
        nativeConfiguration: 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];',
        invalidConfiguration: 'throw new Error("Invalid native configuration");',
        formatter: ['--format', 'json'],
        sample: 'missing()\n',
        partial: 'missing();\n',
        corrected: 'export {};\n',
    },
] as const;

export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        toolArguments: ['--write', 'source.txt=original', '--exit', '3'],
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'finding exit with corrected bytes',
        toolArguments: ['--write', 'source.txt=corrected', '--exit', '3'],
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
        note: undefined,
    },
    {
        name: 'undeclared exit with partial bytes',
        toolArguments: ['--write', 'source.txt=partial', '--exit', '4'],
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'sandbox/fixer exited 4',
    },
    {
        name: 'default failure with original bytes',
        toolArguments: ['--exit', '3'],
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;

export const TSC_REPLACEMENTS = [
    { configuration: 'vue', check: 'vue/vue-tsc', source: 'src/App.vue', text: '<template><p>App</p></template>' },
] as const;

export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;

export const QUALITY_SEARCH_ARGUMENTS = [
    '--text',
    'corrected\n',
    '--match',
    'differs',
    '--log',
    'checked.txt',
    '--',
    '{files}',
];

const HEADERS_FILE = `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: same-origin
    X-Frame-Options: DENY
`;

export const SCOPE_FINDINGS = [
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'service-role-key' }],
    },
    {
        check: 'translations/messages',
        root: [],
        nested: [{ file: 'apps/backend/messages/de.json' }],
    },
    {
        check: 'cloudflare/headers',
        root: [],
        nested: [
            { file: 'apps/backend/_headers', rule: 'missing-header' },
            { file: 'apps/backend/_headers', rule: 'missing-header' },
        ],
    },
    {
        check: 'site/unused-assets',
        root: [{ file: 'assets/unused.png', rule: 'unused-asset' }],
        nested: [],
    },
] as const;

export const SCOPE_CHECK_FILES = {
    'package.json': '{"private":true,"dependencies":{"next-intl":"4.8.3"}}',
    _headers: HEADERS_FILE,
    'messages/en.json': '{"title":"Home"}',
    'messages/de.json': '{"title":"Start"}',
    'supabase/config.toml': '[functions.root]\nverify_jwt = true\n',
    'supabase/functions/root/index.ts': 'export {};\n',
    'assets/unused.png': new Uint8Array([0, 1, 2, 3]),
    'apps/backend/index.html': '<img alt="Backend diagram" src="/assets/unused.png">',
    'apps/backend/_headers': '/*\n    X-Content-Type-Options: nosniff\n',
    'apps/backend/messages/en.json': '{"heading":"Backend"}',
    'apps/backend/messages/de.json': '{}',
    'apps/backend/supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
    'apps/backend/client.ts': 'const credentialName = "SUPABASE_SERVICE_ROLE_KEY";\n',
} as const;

const RANGE_PACKAGE = '{"name":"example","private":true,"devDependencies":{"typescript":"^6.0.3"}}\n';

const PNPM_TYPESCRIPT_LOCK =
    "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      typescript:\n        specifier: ^6.0.3\n        version: 6.0.3\n";

export const TYPESCRIPT_PIN_CASES = [
    {
        name: 'an exact version',
        files: { 'package.json': '{"name":"example","private":true,"devDependencies":{"typescript":"6.0.3"}}\n' },
        untracked: [],
        isProjectPin: true,
    },
    {
        name: 'a range that the tracked lockfile resolves',
        files: { 'package.json': RANGE_PACKAGE, 'pnpm-lock.yaml': PNPM_TYPESCRIPT_LOCK },
        untracked: [],
        isProjectPin: true,
    },
    {
        name: 'a range with an untracked lockfile',
        files: { 'package.json': RANGE_PACKAGE, 'pnpm-lock.yaml': PNPM_TYPESCRIPT_LOCK },
        untracked: ['pnpm-lock.yaml'],
        isProjectPin: false,
    },
    {
        name: 'a version that typescript-eslint does not support',
        files: { 'package.json': '{"name":"example","private":true,"devDependencies":{"typescript":"3.9.10"}}\n' },
        untracked: [],
        isProjectPin: false,
    },
] as const;
