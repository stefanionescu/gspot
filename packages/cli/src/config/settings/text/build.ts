/** Root values precede every table in written settings. */
export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'test_files',
    'tool_timeout_seconds',
] as const;

/** The topic tables, which come before tool options and exceptions. */
export const FIRST_TABLES = [
    'hooks',
    'ci',
    'rules',
    'format',
    'limits',
    'naming',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'spelling',
] as const;

/** The last tables, with command checks before ignores. */
export const LAST_TABLES = ['tools', 'scope', 'import_rule', 'command_check', 'ignore'] as const;
