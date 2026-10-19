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

const TEMPLATE_COMMENT_PREFIX = '# Copied from template ';
const METADATA_PREFIXES = [TEMPLATE_COMMENT_PREFIX] as const;
const SCHEMA_URL = 'https://generativespotting.com/gspot.schema.json';
const SCHEMA_FILE = 'gspot.schema.json';

const RECORD_FIELDS = {
    scope: ['path', 'configurations', 'removed_configurations', 'test_files'],
    command_check: ['name', 'command', 'paths', 'stage', 'summary', 'help', 'fix', 'exit_codes', 'output'],
    ignore: ['check', 'rule', 'names', 'paths', 'reason', 'until'],
    import_rule: ['name', 'paths', 'can_also_import', 'can_import'],
    'format.override': [
        'paths',
        'indent_style',
        'indent_width',
        'print_width',
        'line_ending',
        'final_newline',
        'quotes',
        'trailing_commas',
        'semicolons',
    ],
    'naming.override': [
        'paths',
        'languages',
        'categories',
        'ignored_prefix',
        'ignored_names_pattern',
        'allow_digits',
        'allow_repeated_words',
        'allowed_names',
        'cases',
        'reason',
    ],
    'coverage.swift_target': ['name', 'lines', 'reason'],
    'licenses.allowed_package': ['name', 'version', 'reason'],
    'site.size_limit': ['paths', 'kilobytes'],
    'tools.eslint.override': ['paths', 'rules', 'runtime'],
    'tools.v8r.schema': ['paths', 'url'],
} as const;

const IGNORE_IDENTITY_FIELDS = ['check', 'rule', 'reason'] as const;
const TOML_ASSIGNMENT_FORMAT = { ...TOML_FORMAT, inlineTableStart: 0 } as const;
const TOML_HEADER_FORMAT = { ...TOML_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER } as const;
const SETTINGS_REFERENCE_URL = 'generativespotting.com/reference/gspot-toml/';
/** The release notes of a version: this prefix, then `v<version>`. */
const RELEASE_NOTES_URL = 'https://github.com/stefanionescu/gspot/releases/tag/';

export {
    ROOT_KEYS,
    SCHEMA_URL,
    LAST_TABLES,
    SCHEMA_FILE,
    FIRST_TABLES,
    RECORD_FIELDS,
    METADATA_PREFIXES,
    RELEASE_NOTES_URL,
    TOML_HEADER_FORMAT,
    PARSE_CONTEXT_LINES,
    IGNORE_IDENTITY_FIELDS,
    TOML_ASSIGNMENT_FORMAT,
    SETTINGS_REFERENCE_URL,
    TEMPLATE_COMMENT_PREFIX,
};

/** The commands that change gspot.toml. */
export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;

/** The checks whose findings name a function, so that an [[ignore]] can list the names it covers. */
export const NAMED_FINDING_CHECKS: ReadonlySet<string> = new Set(['structure/trivial-functions', 'python/vulture']);
