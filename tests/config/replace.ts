import { COMMITLINT_PACKAGE } from '#tests/config/commitlint.ts';

/** Native Python project tables retained when generated configuration takes over. */
export const REPLACED_PYPROJECT_TABLES = [
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
        generated: { folder: '.gspot/config', file: 'sqlfluff.cfg' },
    },
] as const;

/** Existing files that inactive all-level checks must leave authored at recommended. */
export const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
} as const;

/** Native Stylelint discovery without an explicit configuration argument. */
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

/** Knip configuration filenames for replacement checks. */
export const KNIP_FILES = [
    { file: '.knip.jsonc', source: '{"entry":["main.js"],"project":["*.js"]}' },
    { file: 'knip.ts', source: 'export default { entry: ["main.js"], project: ["*.js"] };\n' },
    { file: 'knip.js', source: 'export default { entry: ["main.js"], project: ["*.js"] };\n' },
] as const;
