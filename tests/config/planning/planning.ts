import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/ignores.ts';

export const GENERATOR_LIMITS = [
    {
        check: 'javascript/eslint',
        file: 'eslint.mjs',
        languages: ['javascript', 'typescript'],
        limits: [
            'file_lines',
            'function_lines',
            'function_statements',
            'block_nesting',
            'callback_nesting',
            'cognitive_complexity',
            'index_exports',
            'trivial_function_statements',
        ],
    },
    {
        check: 'swift/swiftlint',
        file: 'swiftlint.yml',
        languages: ['swift'],
        limits: [
            'file_lines',
            'function_parameters',
            'function_lines',
            'type_lines',
            'closure_lines',
            'cyclomatic_complexity',
        ],
    },
] as const;

export const BUILT_IN_LIMIT_CASES = [
    {
        check: 'python/function-size',
        language: 'python',
        limit: 'function_lines',
        file: 'source.py',
        source: 'def perform():\n    first()\n    second()\n    third()\n',
        rule: 'function-lines',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'function_lines',
        file: 'source.sh',
        source: 'perform() {\n    first\n    second\n}\n',
        rule: 'function-lines',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'function_branches',
        file: 'source.sh',
        source: 'perform() {\nif true; then first; fi\nif true; then second; fi\nif true; then third; fi\nif true; then fourth; fi\n}\n',
        rule: 'function-branches',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'block_nesting',
        file: 'source.sh',
        source: 'perform() {\nif true; then\nif true; then\nif true; then\nif true; then first; fi\nfi\nfi\nfi\n}\n',
        rule: 'block-nesting',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'function_assignments',
        file: 'source.sh',
        source: 'perform() {\na=1\nb=2\nc=3\nd=4\n}\n',
        rule: 'function-assignments',
    },
    {
        check: 'structure/long-files',
        language: 'python',
        limit: 'file_lines',
        file: 'source.py',
        source: 'a = 1\nb = 2\nc = 3\nd = 4\n',
        rule: 'file-lines',
    },
    {
        check: 'structure/long-files',
        language: 'sql',
        limit: 'file_lines',
        file: 'source.sql',
        source: 'SELECT 1;\nSELECT 2;\nSELECT 3;\nSELECT 4;\n',
        rule: 'file-lines',
    },
    {
        check: 'structure/long-files',
        language: 'bash',
        limit: 'file_lines',
        file: 'source.sh',
        source: 'first\nsecond\nthird\nfourth\n',
        rule: 'file-lines',
    },
    {
        check: 'structure/trivial-functions',
        language: 'python',
        limit: 'trivial_function_statements',
        file: 'source.py',
        source: 'def perform():\n    first()\n    second()\n    third()\n',
        rule: 'trivial-function',
    },
    {
        check: 'structure/trivial-functions',
        language: 'swift',
        limit: 'trivial_function_statements',
        file: 'source.swift',
        source: 'func perform() {\nfirst()\nsecond()\nthird()\n}\n',
        rule: 'trivial-function',
    },
    {
        check: 'structure/trivial-functions',
        language: 'bash',
        limit: 'trivial_function_statements',
        file: 'source.sh',
        source: 'perform() {\nfirst\nsecond\nthird\n}\n',
        rule: 'trivial-function',
    },
] as const;

export const SESSION_FILES = {
    'package.json': '{"private":true,"packageManager":"bun@1.2.3"}\n',
    'entry.js': 'export const target = 1;\n',
    [`${GSPOT_FOLDER}/.keep`]: '',
};

const NEXT_INTL_PACKAGE = '{"dependencies":{"next-intl":"4.8.3"}}';

export const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'own child project',
        scope: 'app',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'inherited root project',
        scope: 'app/deep',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
    {
        name: 'own child replaces inherited dependencies',
        scope: 'app',
        files: {
            'package.json': NEXT_INTL_PACKAGE,
            'app/package.json': '{"dependencies":{"react-i18next":"16.5.3"}}',
        },
        selected: false,
    },
] as const;

export const VUE_TSC_SKIP = [
    {
        check: 'vue/vue-tsc',
        skip: { cause: 'condition', note: 'Needs the typescript configuration, which this scope does not select.' },
    },
] as const;

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
    {
        name: 'Bun with TypeScript',
        tables: '',
        configurations: ['typescript'],
        files: {
            'app.ts': 'export const value = 1;\n',
            'package.json': '{"private":true,"engines":{"bun":"1.4.2"}}\n',
        },
        needs: ['node', 'eslint'],
        skips: [],
    },
] as const;

export const ARCHITECTURE_REQUIREMENTS = [
    {
        name: 'root modules',
        tables: `[[import_rule]]
name = "app"
paths = ["src/**"]
`,
        boundary: { basic: true, all: true },
    },
    { name: 'selected role defaults without modules', tables: '', boundary: { basic: false, all: true } },
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
