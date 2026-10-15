/** Root values precede every table in written settings. */
const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'allowed_words',
    'test_files',
    'tool_timeout_seconds',
] as const;

/** Concern tables before tool options and written exceptions. */
const FIRST_TABLES = [
    'hooks',
    'ci',
    'rules',
    'format',
    'limits',
    'naming',
    'architecture',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'spelling',
] as const;

/** The final sections keep declarations and custom checks before ignores. */
const LAST_TABLES = ['tools', 'scope', 'command_check', 'ignore'] as const;

/** Value encoding and concrete syntax tree array layout. */
const TOML_FORMAT = { updateOrder: true, bracketSpacing: true, trailingComma: false } as const;

/** Document metadata precedes every settings section. */

/** Parse diagnostics show the location, source line, and caret. */
const PARSE_CONTEXT_LINES = 3;

const SCHEMA_COMMENT_PREFIX = '#:schema ';
const TEMPLATE_COMMENT_PREFIX = '# Copied from template ';
const METADATA_PREFIXES = [SCHEMA_COMMENT_PREFIX, TEMPLATE_COMMENT_PREFIX] as const;
const SCHEMA_URL_PREFIX = 'https://unpkg.com/@gspothq/cli@';
const SCHEMA_FILE = 'gspot.schema.json';

const RECORD_FIELDS = {
    scope: ['path', 'configurations', 'removed_configurations', 'test_files'],
    command_check: ['name', 'command', 'paths', 'stage', 'summary', 'help', 'fix', 'exit_codes', 'output'],
    ignore: ['check', 'rule', 'paths', 'reason', 'until'],
    'architecture.module': ['name', 'paths', 'may_import'],
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
        'allow_digits',
        'allow_repeated_words',
        'allowed_names',
        'cases',
        'reason',
    ],
    'coverage.target': ['name', 'lines', 'reason'],
    'licenses.allowed_package': ['name', 'version', 'reason'],
    'site.size_limit': ['paths', 'kilobytes'],
    'tools.eslint.override': ['paths', 'rules', 'runtime'],
    'tools.v8r.schema': ['paths', 'url'],
} as const;

const IGNORE_IDENTITY_FIELDS = ['check', 'rule', 'reason'] as const;
const TOML_ASSIGNMENT_FORMAT = { ...TOML_FORMAT, inlineTableStart: 0 } as const;
const TOML_HEADER_FORMAT = { ...TOML_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER } as const;
const SETTINGS_REFERENCE_URL = 'generativespotting.com/reference/gspot-toml/';

export {
    ROOT_KEYS,
    LAST_TABLES,
    SCHEMA_FILE,
    FIRST_TABLES,
    RECORD_FIELDS,
    METADATA_PREFIXES,
    SCHEMA_URL_PREFIX,
    TOML_HEADER_FORMAT,
    PARSE_CONTEXT_LINES,
    IGNORE_IDENTITY_FIELDS,
    TOML_ASSIGNMENT_FORMAT,
    SETTINGS_REFERENCE_URL,
    TEMPLATE_COMMENT_PREFIX,
};
