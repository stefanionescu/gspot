export const PLAN_INIT = [
    'init',
    '--yes',
    '--configurations',
    'bash',
    'javascript',
    'spelling',
    'markdown',
    '--no-task',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

/** Native Python project tables retained when generated configuration takes over. */
export const PYPROJECT_TAKEOVERS = [
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
];
