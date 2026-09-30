// The literal values policy reads: names, patterns, limits, and tables.

// A problem on one of these fields belongs to the entry or key that holds the field, and reading drops that owner.
export const FIELD_PROBLEMS = new Set(['reason', 'paths', 'path', 'basePath', 'module', 'group']);
export const INDENT_MAX = 8;
export const PRINT_WIDTH_MIN = 40;
export const PRINT_WIDTH_MAX = 400;
export const NEAR_DISTANCE_LIMIT = 3;
export const TYPO_MIN = 2;
export const TYPO_FRACTION = 3;
export const LIST_LIMIT = 8;
export const DEFAULT_INDENT_WIDTH = 4;
/** The most characters one line of gspot.toml holds. */
export const POLICY_LINE_WIDTH = 120;
export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);
export const NAMING_SCALARS = ['max_chars', 'max_words', 'case'] as const;
export const OVERRIDING_KINDS = new Set(['framework', 'platform', 'library', 'database']);
export const NAMING_LIST_KEYS = new Set([
    'banned_terms',
    'allowed',
    'external',
    'reserved',
    'remove_groups',
    'contract_properties',
    'rules',
]);
export const CATEGORY_KEYS = new Set(['max_chars', 'max_words', 'case']);
export const REFUSED_REASONS = [
    '',
    'n/a',
    'na',
    'tbd',
    'todo',
    '-',
    '--',
    'none',
    'x',
    'because',
    'reason',
    'fixme',
    'wip',
    '.',
];
export const MINIMUM_REASON_WORDS = 2;
export const LIMITS_PREFIX = 'limits.';
export const TOOL_PREFIX = 'tools.';
export const RESERVED_SLOTS = new Set(['extra']);
/** A tool setting key is tools.<tool>.<slot>: two segments before the slot. */
export const TOOL_KEY_DEPTH = 2;
