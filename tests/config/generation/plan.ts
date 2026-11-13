import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';

export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;
export const REPLACED_CONFIG_DELETIONS = [
    { path: '.shellcheckrc' },
    { path: '.prettierrc' },
    { path: '.eslintrc.json' },
    { path: 'typos.toml' },
] as const;
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
export const SHARED_SETUP_CONFIG = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01
`;
export const STYLELINT_REPLACEMENT_CASES = [
    {
        name: 'a root package field',
        scope: '',
        packageText: STYLELINT_PACKAGE_JSON,
        initArguments: ['--configurations', 'css'],
        changed: ['package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a scoped package field',
        scope: 'app',
        packageText: STYLELINT_PACKAGE_JSON,
        initArguments: ['--configurations', 'gspot'],
        changed: ['app/package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a standalone file',
        scope: '',
        packageText: '{"private":true,"type":"module"}',
        initArguments: ['--configurations', 'css'],
        changed: [],
        unchangedFiles: [{ path: 'package.json', text: '{"private":true,"type":"module"}' }],
    },
] as const;
