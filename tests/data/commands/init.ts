import { COMMITLINT_PACKAGE } from '#tests/data/checks/commits.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

/** pyproject.toml tables that init leaves in place while a generated tool file takes over. */
const REPLACED_PYPROJECT_TABLES = [
    {
        configuration: 'python',
        table: 'tool.basedpyright',
        text: '[tool.basedpyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        generated: { folder: '', file: 'pyrightconfig.json' },
    },
    {
        configuration: 'python',
        table: 'tool.pyright',
        text: '[tool.pyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        generated: { folder: '', file: 'pyrightconfig.json' },
    },
    {
        configuration: 'sql',
        table: 'tool.sqlfluff',
        text: '[tool.sqlfluff.core]\ndialect = "postgres"\n',
        source: { file: 'query.sql', text: 'SELECT 1;\n' },
        generated: { folder: '.gspot/configurations/language/sql', file: 'sqlfluff.cfg' },
    },
] as const;

/** Existing tool files that checks for level all must leave alone at level recommended. */
const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
} as const;

/** A script that runs Stylelint without a path to a tool file, so Stylelint finds one itself. */
const STYLELINT_LOOKUP_SCRIPT = `
import stylelint from './.gspot/node_modules/stylelint/lib/index.mjs';
const result = await stylelint.lint({ files: [process.argv[1]], cwd: process.cwd() });
const findings = result.results.flatMap(({ warnings, parseErrors, invalidOptionWarnings }) => [
    ...warnings.map(({ rule, line, column, severity }) => ({ rule, line, column, severity })),
    ...parseErrors,
    ...invalidOptionWarnings,
]);
process.stdout.write(JSON.stringify(findings));
`;

/** Authored lint jobs that stop init from adding CI by itself, but not when a provider flag asks for it. */
const LINT_JOBS = [
    { name: 'a GitLab lint job', path: '.gitlab-ci.yml', content: 'quality:\n  script: npm run lint\n' },
    {
        name: 'a GitHub lint job',
        path: '.github/workflows/application.yml',
        content: `on: push
jobs:
  quality:
    runs-on: ubuntu-24.04
    steps:
      - run: npm run lint
`,
    },
] as const;

/** Repository CI signals and the provider each signal selects. */
const CI_PREFERENCE_CASES = [
    [
        'a GitHub workflow before a GitLab remote',
        ['.github/workflows/build.yml'],
        '',
        'git@gitlab.com:example/repo.git',
        'github',
    ],
    [
        'tracked GitLab before GitHub',
        ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        '',
        'git@github.com:example/repo.git',
        'gitlab',
    ],
    ['GitLab file before GitHub remote', [], '.gitlab-ci.yml', 'git@github.com:example/repo.git', 'gitlab'],
    [
        'GitHub remote with unrelated Bitbucket configuration',
        ['bitbucket-pipelines.yml'],
        '',
        'git@github.com:example/repo.git',
        'github',
    ],
    ['GitHub SSH remote', [], '', 'git@github.com:example/repo.git', 'github'],
    ['unrecognized remote host', [], '', 'https://github.com.example.com/example/repo.git', 'none'],
] as const;

const FORMAT_FILE_CASES = [
    {
        name: 'no formatter configuration',
        files: {},
        expected: { indent_width: 4, print_width: 120 },
    },
    {
        name: 'Prettier dependency without configuration',
        files: { 'package.json': '{"devDependencies":{"prettier":"3.8.1"}}' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'partial Prettier JSON configuration',
        files: { '.prettierrc.json': '{"tabWidth":3}' },
        expected: { indent_width: 3, print_width: 80, quotes: 'double' },
    },
    {
        name: 'Prettier package configuration',
        files: { 'package.json': '{"prettier":{"tabWidth":6,"printWidth":100,"singleQuote":true}}' },
        expected: { indent_width: 6, print_width: 100, quotes: 'single' },
    },
    {
        name: 'Prettier JavaScript configuration',
        files: { 'prettier.config.mjs': 'export default { tabWidth: 3, printWidth: 90, singleQuote: false };' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'EditorConfig without indent_style',
        files: {
            '.editorconfig': `root = true
[*]
indent_size = 3
max_line_length = 96
`,
        },
        expected: { indent_width: 3, print_width: 96 },
    },
    {
        name: 'EditorConfig project settings and section overrides',
        files: { '.editorconfig': '[*]\nindent_size = 4\n[*.json]\nindent_size = 2\n' },
        expected: { indent_width: 4, override: [{ paths: ['**/*.json'], indent_width: 2 }] },
    },
    {
        name: 'Prettier precedence over EditorConfig',
        files: {
            '.prettierrc.json': '{"singleQuote":true}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'single' },
    },
    {
        name: 'declared Prettier defaults before EditorConfig',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
] as const;

const SCOPE_FORMAT_FILES = {
    '.prettierrc.json': '{"tabWidth":2,"printWidth":90,"singleQuote":false}',
    'app/.prettierrc.json': '{"tabWidth":6,"printWidth":100,"singleQuote":true}',
    'app/source.js': 'export const app = 1;\n',
    'app/deep/source.js': 'export const deep = 1;\n',
    'sibling/source.js': 'export const sibling = 1;\n',
} as const;

const ROOT_INDENT_WIDTH = 2;
const SCOPE_INDENT_WIDTH = 6;
const ROOT_PRINT_WIDTH = 90;
const SCOPE_PRINT_WIDTH = 100;

const SCOPE_FORMAT_CASES = [
    {
        name: 'repository configuration',
        expected: [
            ['', ROOT_INDENT_WIDTH, ROOT_PRINT_WIDTH, 'double'],
            ['app', SCOPE_INDENT_WIDTH, SCOPE_PRINT_WIDTH, 'single'],
            ['app/deep', SCOPE_INDENT_WIDTH, SCOPE_PRINT_WIDTH, 'single'],
            ['sibling', ROOT_INDENT_WIDTH, ROOT_PRINT_WIDTH, 'double'],
        ],
    },
] as const;

/** Git-dependent plan rows belong only to a repository with a Git index. */
const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false },
    { name: 'a Git repository', hasGit: true },
] as const;

const PYTHON_SOURCE = { 'source.py': 'VALUE = 1\n' };

const TOOL_ONLY_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

const REPLACED_TOOL_FILES = {
    'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
} as const;

const INIT_FILES = {
    ...REPLACED_TOOL_FILES,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
} as const;

/** Empty and named language lists both keep the common checks. */
const CONFIGURATION_CHOICES = [
    { configurations: undefined },
    { configurations: undefined, noConfigurations: true },
    { configurations: ['python'] },
] as const;

export {
    LINT_JOBS,
    INIT_FILES,
    PYTHON_SOURCE,
    GIT_PLAN_CASES,
    FORMAT_FILE_CASES,
    TOOL_ONLY_PACKAGE,
    SCOPE_FORMAT_CASES,
    SCOPE_FORMAT_FILES,
    CI_PREFERENCE_CASES,
    REPLACED_TOOL_FILES,
    CONFIGURATION_CHOICES,
    INACTIVE_CONFIGURATIONS,
    STYLELINT_LOOKUP_SCRIPT,
    REPLACED_PYPROJECT_TABLES,
};

/** A file that changes between the init plan and the write: an edited package.json field. */
export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

export const IMPORT_STYLE_CASES = [
    {
        name: 'a tsconfig that imports .ts files by name',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'ts',
    },
    {
        name: 'an esbuild bundle',
        files: {
            'package.json': '{"private":true,"type":"module","devDependencies":{"esbuild":"0.25.0"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'extensionless',
    },
    {
        name: 'a Node.js package',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: undefined,
    },
] as const;
