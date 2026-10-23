import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { COMMITLINT_PACKAGE } from '#tests/config/checks/general/commits.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/checks/language/css.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';

export const REPLACED_PYPROJECT_TABLES = [
    {
        configuration: 'python',
        table: 'tool.basedpyright',
        text: '[tool.basedpyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        tool: 'basedpyright',
        generated: 'pyrightconfig.json',
    },
    {
        configuration: 'python',
        table: 'tool.pyright',
        text: '[tool.pyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        tool: 'basedpyright',
        generated: 'pyrightconfig.json',
    },
    {
        configuration: 'sql',
        table: 'tool.sqlfluff',
        text: '[tool.sqlfluff.core]\ndialect = "postgres"\n',
        source: { file: 'query.sql', text: 'SELECT 1;\n' },
        tool: 'sqlfluff',
        generated: findManifestTarget('sql', 'sqlfluff.cfg'),
    },
] as const;

export const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
} as const;

export const STYLELINT_LOOKUP_SCRIPT = `
import stylelint from './.gspot/node_modules/stylelint/lib/index.mjs';
const result = await stylelint.lint({ files: [process.argv[1]], cwd: process.cwd() });
const findings = result.results.flatMap(({ warnings, parseErrors, invalidOptionWarnings }) => [
    ...warnings.map(({ rule, line, column, severity }) => ({ rule, line, column, severity })),
    ...parseErrors,
    ...invalidOptionWarnings,
]);
process.stdout.write(JSON.stringify(findings));
`;

const REPLACED_CONFIG_FILES = {
    'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
} as const;

export const INIT_FILES = {
    ...REPLACED_CONFIG_FILES,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
} as const;

export const STYLELINT_REPLACEMENT_CASES = [
    {
        name: 'a root package field',
        scope: '',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--yes', '--configurations', 'css'],
        changed: ['package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a scoped package field',
        scope: 'app',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--yes', '--no-configurations'],
        changed: ['app/package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a standalone file',
        scope: '',
        packageText: '{"private":true,"type":"module"}',
        command: ['init', '--yes', '--configurations', 'css'],
        changed: [],
        unchangedFiles: [{ path: 'package.json', text: '{"private":true,"type":"module"}' }],
    },
] as const;

export const LINKED_SETUP_CONFIG = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01
`;

export const SQL_PACKAGE_FILES = {
    'README.md': '# test\n',
    'db/accounts.sql': 'SELECT 1;\n',
    'db/package.json': '{"private":true}',
    'db/.sqlfluffignore': '# Templates\ntemplates/\n',
} as const;

export const SHARED_SETUP_CONFIG = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01, RF01
`;

export const VALID_CSS = `a {
    opacity: 1;
}
`;

export const REPLACED_CONFIG_DELETIONS = [
    { path: '.shellcheckrc', note: 'replaced by the generated shellcheck config file' },
    { path: '.prettierrc', note: 'replaced by the generated prettier config file' },
    { path: '.eslintrc.json', note: 'replaced by the generated eslint config file' },
    { path: 'typos.toml', note: 'replaced by the generated typos config file' },
] as const;

export const LINT_FOLDER_NOTE = {
    path: 'quality/',
    note: 'a folder of lint scripts; check remaining references before deleting it',
} as const;

export const HOOKS_PATH_CASES = [
    { hooksPath: '', line: 'hooks                none' },
    { hooksPath: 'hooks', line: 'hooks                hooks/  pre-commit, use-thing.ts (your own)' },
    { hooksPath: '.husky', line: 'hooks                .husky/  pre-commit (husky)' },
] as const;

export const HOOK_NAMED_SOURCE = 'export function useThing() { return true; }\n';
