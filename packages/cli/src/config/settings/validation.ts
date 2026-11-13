import { IMPORT_EXTENSION_SETTING } from '#cli/config/settings/detected.ts';

// keys
export const AT_TOP_LEVEL = 'at the top level';
export const TABLE_KEY_SEGMENTS = 2;
export const UNDER_TABLE = 'under that table';

// reasons
export const ADD_REASON_MESSAGE = 'Add reason = "..." to this record.';
export const COVERAGE_LINES_SETTING = 'coverage.min_line_percent';
export const EMPTY_REASON = 'an empty reason';
export const REASON_WORDS_MIN = 2;
export const REMOVAL_REASON_SUGGESTION = 'Run gspot remove <configuration> --reason "<why>".';
export const REMOVED_CONFIGURATIONS = 'removed_configurations';
export const SWIFT_TARGET_MESSAGE =
    'A Swift target with a lower line minimum than coverage.min_line_percent needs a reason.';
export const TRAILING_PERIOD = /\.$/u;

// rule files
export const FIRST_READ: readonly string[] = ['WORKING.md', 'WRITING.md'];

// setting rules
export const SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    eslint: {
        'gspot/no-identical-functions': 'structure.min_duplicate_lines',
        'no-restricted-imports': 'javascript.banned_imports',
        'gspot/import-boundaries': 'javascript.import_boundaries',
        'gspot/no-trivial-files': 'structure.reexports',
        'n/file-extension-in-import': IMPORT_EXTENSION_SETTING,
    },
};
