import type { PlanOptions } from '#cli/types/planning.ts';
import { NPM_CHECK_IGNORES } from '#tests/data/test-setup.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/data/settings/scopes.ts';

/** A path ignore applies to one check and keeps the rule findings of the others. */
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
        name: 'another check’s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'files/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

export const PROJECT_TRIGGERS = [
    ['delete', 'staged'],
    ['rename', 'changed'],
] as const;

export const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);

export const PROJECT_OPTIONS = { stage: 'push', only: ['typescript/tsc'] } satisfies Pick<
    PlanOptions,
    'stage' | 'only'
>;

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
        name: 'unrelated sibling project',
        scope: 'app',
        files: { 'sibling/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
    { name: 'absent project', scope: 'app', files: {}, selected: false },
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

/** Lockfile changes start the dependency advisory scan. Other inputs only feed the analysis. */
export const LOCKFILE_TRIGGER_NAMES = [
    'bun.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'uv.lock',
] as const;

export const TSC_REPLACEMENTS = [
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
export const NODE_REQUIREMENTS = [
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

/** Pushed checks chosen by name still read the Git history. */
export const HISTORY_TABLES = `[[scope]]
path = "app"
configurations = ["commits", "secrets"]
`;

export const TOOL_FILE_PLANNING_CASES = [
    {
        name: 'a TypeScript-only scope selects Knip',
        files: {
            'gspot.toml': buildSandboxSettings(['typescript'], { tables: '[rules]\nenabled = false\n' }),
            'src/main.ts': 'export const value = 1;\n',
        },
        check: 'javascript/knip',
        selected: true,
    },
    {
        name: 'Go and Rust sources do not select Prettier',
        files: {
            'gspot.toml': buildSandboxSettings([], { level: 'all', rules: true }),
            'main.go': 'package main\nfunc main() {}\n',
            'main.rs': 'fn main() {}\n',
        },
        check: 'format/prettier',
        selected: false,
    },
] as const;
