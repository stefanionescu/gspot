import { NPM_CHECK_IGNORES } from '#tests/config/setup/sandboxes.ts';

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
        name: 'Python with Markdown',
        tables: '',
        configurations: ['python', 'markdown'],
        files: { 'app.py': 'value = 1\n', 'guide.md': '# Guide\n' },
        needs: ['node', 'markdownlint-cli2'],
        skips: ['eslint', 'typescript'],
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
        boundary: { recommended: true, all: true },
    },
    { name: 'selected role defaults without modules', tables: '', boundary: { recommended: false, all: true } },
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

export const INDEPENDENT_LIBRARIES = [
    '@eslint/js',
    '@gspothq/eslint-plugin',
    'eslint-plugin-sonarjs',
    'eslint-plugin-unicorn',
    'eslint-plugin-security',
    'eslint-plugin-barrel-files',
    'eslint-plugin-perfectionist',
    'eslint-plugin-n',
    'eslint-plugin-jsdoc',
    'eslint-plugin-regexp',
    'eslint-plugin-import-x',
    'eslint-import-resolver-typescript',
    'eslint-plugin-package-json',
    'eslint-config-prettier',
    'globals',
    'picomatch',
    'independent-support',
] as const;
