// The literal values policy/adoption reads: names, patterns, limits, and tables.

export const IGNORE_FILE_COMMENT = '#';
export const ABSOLUTE_OR_ESCAPED = /[\\:]/u;
export const GLOB_MAGIC = /[*?{[!]/u;
export const UNSAFE_EXTEND = /[\\:$~]/u;
export const COMMENT_MARK = /^(?:#|\/\/)\s?/u;
// The setting an ignore-path file of a tool fills, for the tools whose importer reads one.
export const IGNORE_PATH_KEYS: Record<string, string> = { sqlfluff: 'exclude', semgrep: 'ignore' };
// Tools whose configuration files are read one at a time, so overlapping files need explicit conversion.
export const SEPARATE_TOOLS = new Set([
    'ruff',
    'typos',
    'stylelint',
    'markdownlint-cli2',
    'license-checker-rseidelsohn',
]);
