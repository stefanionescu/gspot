import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';

const COMMITLINT_PACKAGE =
    '{"name":"native-project","private":true,"commitlint":{"rules":{"type-enum":[2,"always",["special"]]}},"kept":[0,false,""]}\n';

export const REPLACED_PYPROJECT_TABLES = [
    {
        configuration: 'python',
        table: 'tool.basedpyright',
        text: '[tool.basedpyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        generated: 'pyrightconfig.json',
    },
    {
        configuration: 'sql',
        table: 'tool.sqlfluff',
        text: '[tool.sqlfluff.core]\ndialect = "postgres"\n',
        source: { file: 'query.sql', text: 'SELECT 1;\n' },
        generated: `${GSPOT_PATHS.configurations}/sql/sqlfluff.cfg`,
    },
] as const;

export const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
} as const;

export const STYLELINT_REPLACEMENT_CASES = [
    {
        name: 'a root package field',
        scope: '',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--configurations', 'css'],
        changed: ['package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a scoped package field',
        scope: 'app',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--configurations', 'gspot'],
        changed: ['app/package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a standalone file',
        scope: '',
        packageText: '{"private":true,"type":"module"}',
        command: ['init', '--configurations', 'css'],
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

export const REPLACED_CONFIG_DELETIONS = [
    { path: '.shellcheckrc' },
    { path: '.prettierrc' },
    { path: '.eslintrc.json' },
    { path: 'typos.toml' },
] as const;

export const HOOKS_PATH_CASES = [
    { hooksPath: '', line: 'existing hooks       none' },
    { hooksPath: 'hooks', line: 'existing hooks       hooks/  pre-commit, use-thing.ts (your own)' },
    { hooksPath: '.husky', line: 'existing hooks       .husky/  pre-commit (husky)' },
] as const;

export const HOOK_NAMED_SOURCE = 'export function useThing() { return true; }\n';

export const SYNCPACK_FILE = {
    file: '.syncpackrc.yaml',
    source: `versionGroups:
  - dependencies: [shared-library]
    isIgnored: true
`,
} as const;

export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;
