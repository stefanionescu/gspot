// format fields
export const ARROW_PARENS = ['always', 'avoid'] as const;
export const FORMAT_INDENT_STYLES = ['space', 'tab'] as const;
export const FORMAT_OVERRIDE_MIN_FIELDS = 2;
export const INDENT_DEFAULT = 4;
export const INDENT_MAX = 8;
export const PRINT_WIDTH_DEFAULT = 120;
export const PRINT_WIDTH_MAX = 400;
export const PRINT_WIDTH_MIN = 40;
export const PROSE_WRAPS = ['always', 'never', 'preserve'] as const;
export const QUOTE_STYLES = ['single', 'double'] as const;
export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

// percentage field
export const MAX_PERCENTAGE = 100;

// relative path field
export const RELATIVE_PATH_PATTERN = new RegExp(
    String.raw`^(?:[^\\:\u0000-\u001f\u007f-\u009f]|\\[()\[\]{}*?!+@,])+$`,
    'u',
);

// setting metadata
export const PATH_ROLES = ['source', 'destination', 'build'] as const;
export const SETTING_TYPES = ['number', 'string', 'path', 'boolean', 'list', 'table'] as const;

// setting origins
export const SETTING_ORIGIN_KINDS = ['default', 'configuration', 'root', 'scope', 'unset'] as const;

// setting reasons
export const BOUND_PREFIXES = { max_: 'raising', min_: 'lowering' } as const;
export const BOUND_REASON_DESCRIPTION =
    'Why this code needs a weaker bound than the default; required when you weaken it.';
export const REASON_DESCRIPTIONS = {
    raising: 'Why this code needs more than the default; required when you raise the value.',
    lowering: 'Why this code needs less than the default; required when you lower the value.',
    adding: 'Why these entries belong; required when you add an entry.',
} as const;
export const REMOVAL_REASON_DESCRIPTION = 'Why you removed this configuration, in two or more words.';
