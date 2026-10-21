/** Root values precede every table in written settings. */
export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'allowed_words',
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

/** How the TOML writer orders keys and lays out arrays. */
const SETTINGS_TOML_FORMAT = { updateOrder: true, bracketSpacing: true, trailingComma: false } as const;

export const IGNORE_IDENTITY_FIELDS = ['check', 'rule', 'reason'] as const;

export const TOML_ASSIGNMENT_FORMAT = { ...SETTINGS_TOML_FORMAT, inlineTableStart: 0 } as const;

export const TOML_HEADER_FORMAT = { ...SETTINGS_TOML_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER } as const;
