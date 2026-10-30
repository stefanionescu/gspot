export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

export const FORMAT_OVERRIDE_MIN_FIELDS = 2;

export const FORMAT_INDENT_STYLES = ['space', 'tab'] as const;

export const REMOVAL_REASON_DESCRIPTION = 'Why you removed this configuration, in two or more words.';

export const SHARED_REMOVALS_DESCRIPTION =
    'Configurations removed with one shared reason by an earlier gspot. The next gspot edit writes one reason for each.';

export const REASON_DESCRIPTIONS = {
    raising: 'Why this code needs more than the default; required when you raise the value.',
    lowering: 'Why this code needs less than the default; required when you lower the value.',
    adding: 'Why these entries belong; required when you add an entry.',
} as const;

export const LINE_ENDINGS = ['lf', 'crlf'] as const;

export const QUOTE_STYLES = ['single', 'double'] as const;

export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

export const RELATIVE_PATH_PATTERN = /^(?:[^\\:\p{Cc}]|\\[()[\]{}*?!+@,])+$/u;
