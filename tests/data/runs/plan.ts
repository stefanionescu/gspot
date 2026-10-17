import { NPM_CHECK_IGNORES } from '#tests/data/test-setup.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/data/settings/scopes.ts';

/** A path ignore applies to one check and keeps the rule findings of the others. */
const PROJECT_PATH_IGNORES = [
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
        name: 'another check’s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'files/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

const PROJECT_TRIGGERS = [
    ['delete', 'staged'],
    ['rename', 'changed'],
] as const;

const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);

const PROJECT_OPTIONS = { stage: 'push' as const, only: ['typescript/tsc'] } as const;

const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'own child project',
        scope: 'app',
        files: { 'app/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'inherited root project',
        scope: 'app/deep',
        files: { 'package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: false,
    },
    {
        name: 'unrelated sibling project',
        scope: 'app',
        files: { 'sibling/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: false,
    },
    { name: 'absent project', scope: 'app', files: {}, selected: false },
    {
        name: 'own child replaces inherited dependencies',
        scope: 'app',
        files: {
            'package.json': '{"dependencies":{"next-intl":"4.8.3"}}',
            'app/package.json': '{"dependencies":{"react-i18next":"16.5.3"}}',
        },
        selected: false,
    },
] as const;

/** Lockfile changes start the dependency advisory scan. Other inputs only feed the analysis. */
const LOCKFILE_TRIGGER_NAMES = [
    'bun.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'uv.lock',
] as const;

const TSC_REPLACEMENTS = [
    { configuration: 'vue', check: 'vue/vue-tsc', source: 'src/App.vue', text: '<template><p>App</p></template>' },
    { configuration: 'svelte', check: 'svelte/svelte-check', source: 'src/App.svelte', text: '<p>App</p>' },
] as const;

const PYTHON_APP_FILES = {
    'app.py': 'value = 1\n',
    'pyproject.toml': `[project]
name = "app"
version = "1.0.0"
`,
} as const;

/** The tool runtime follows the npm checks that apply, not the language runtime of the repository. */
const NODE_REQUIREMENTS = [
    {
        name: 'Python with npm schema peers under mise',
        tables: '',
        configurations: ['python'],
        files: PYTHON_APP_FILES,
        node: true,
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
        node: false,
    },
    {
        name: 'Python with Markdown',
        tables: '',
        configurations: ['python', 'markdown'],
        files: { 'app.py': 'value = 1\n', 'guide.md': '# Guide\n' },
        node: true,
    },
    {
        name: 'Bun with TypeScript',
        tables: '',
        configurations: ['typescript'],
        files: {
            'app.ts': 'export const value = 1;\n',
            'package.json': '{"private":true,"engines":{"bun":"1.4.2"}}\n',
        },
        node: true,
    },
] as const;

/** Modules apply at both levels. Roles and test paths apply at level all. */
const ARCHITECTURE_REQUIREMENTS = [
    {
        name: 'root modules',
        tables: `[[architecture.module]]
name = "app"
paths = ["src/**"]
`,
        boundary: { recommended: true, all: true },
    },
    { name: 'selected role defaults without modules', tables: '', boundary: { recommended: false, all: true } },
] as const;

const COVERAGE_LIMITS = [
    {
        configuration: 'pytest',
        provider: 'pytest-cov',
        file: 'test_math.py',
        configurations: ['python', 'pytest'],
        lines: 0,
    },
    {
        configuration: 'pytest',
        provider: 'pytest-cov',
        file: 'test_math.py',
        configurations: ['python', 'pytest'],
        lines: 80,
    },
    {
        configuration: 'vitest',
        provider: '@vitest/coverage-v8',
        file: 'math.test.js',
        configurations: ['javascript', 'vitest'],
        lines: 0,
    },
    {
        configuration: 'vitest',
        provider: '@vitest/coverage-v8',
        file: 'math.test.js',
        configurations: ['javascript', 'vitest'],
        lines: 80,
    },
] as const;

/** Pushed checks chosen by name still read the Git history. */
const HISTORY_TABLES = `[[scope]]
path = "app"
configurations = ["commits", "secrets"]
`;

const TOOL_FILE_PLANNING_CASES = [
    {
        name: 'a TypeScript-only scope selects Knip',
        files: {
            'gspot.toml': `configurations = ["typescript"]
[rules]
enabled = false
`,
            'src/main.ts': 'export const value = 1;\n',
        },
        check: 'javascript/knip',
        selected: true,
    },
    {
        name: 'Go and Rust sources do not select Prettier',
        files: {
            'gspot.toml': 'level = "all"\nconfigurations = []\n',
            'main.go': 'package main\nfunc main() {}\n',
            'main.rs': 'fn main() {}\n',
        },
        check: 'format/prettier',
        selected: false,
    },
] as const;

export {
    HISTORY_TABLES,
    COVERAGE_LIMITS,
    PROJECT_OPTIONS,
    PROJECT_TRIGGERS,
    TSC_REPLACEMENTS,
    NODE_REQUIREMENTS,
    NEXT_INTL_PROJECTS,
    PROJECT_PATH_IGNORES,
    LOCKFILE_TRIGGER_NAMES,
    TOOL_FILE_PLANNING_CASES,
    ARCHITECTURE_REQUIREMENTS,
    TYPESCRIPT_SCOPES_SETTINGS,
};
