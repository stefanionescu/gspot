/** Root values precede every table in written settings. */
const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'allowed_words',
    'test_files',
    'tool_timeout_seconds',
] as const;

/** The topic tables, which come before tool options and exceptions. */
const FIRST_TABLES = [
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
const LAST_TABLES = ['tools', 'scope', 'import_rule', 'command_check', 'ignore'] as const;

/** How the TOML writer orders keys and lays out arrays. */
const TOML_FORMAT = { updateOrder: true, bracketSpacing: true, trailingComma: false } as const;

/** Parse errors show the location, the source line, and a caret. */
const PARSE_CONTEXT_LINES = 3;

const SCHEMA_URL = 'https://generativespotting.com/gspot.schema.json';
const SCHEMA_FILE = 'gspot.schema.json';

const IGNORE_IDENTITY_FIELDS = ['check', 'rule', 'reason'] as const;
const TOML_ASSIGNMENT_FORMAT = { ...TOML_FORMAT, inlineTableStart: 0 } as const;
const TOML_HEADER_FORMAT = { ...TOML_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER } as const;
const SETTINGS_REFERENCE_URL = 'generativespotting.com/reference/gspot-toml/';

export {
    ROOT_KEYS,
    SCHEMA_URL,
    LAST_TABLES,
    SCHEMA_FILE,
    FIRST_TABLES,
    TOML_HEADER_FORMAT,
    PARSE_CONTEXT_LINES,
    IGNORE_IDENTITY_FIELDS,
    TOML_ASSIGNMENT_FORMAT,
    SETTINGS_REFERENCE_URL,
};

/** The commands that change gspot.toml. */
export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;

export const NAMED_FINDING_CHECKS: ReadonlySet<string> = new Set(['structure/trivial-functions', 'python/vulture']);
