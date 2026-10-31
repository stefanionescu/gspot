export const AT_TOP_LEVEL = 'at the top level';

export const UNDER_TABLE = 'under that table';

export const REASON_WORDS_MIN = 2;

export const ADD_REASON_MESSAGE = 'Add reason = "..." to this record.';

export const EMPTY_REASON = 'an empty reason';

export const REMOVAL_REASON_SUGGESTION = 'Run gspot remove <configuration> --reason "<why>".';

export const SETTINGS_REFERENCE_URL = 'generativespotting.com/reference/gspot-toml/';

export const RECORD_PATHS_MESSAGE = ' Its paths say where it applies.';

export const SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    eslint: {
        'sonarjs/no-identical-functions': 'duplication.min_lines',
        'no-restricted-imports': 'tools.eslint.restricted_imports',
        'gspot/import-boundaries': 'javascript.import_boundaries',
        'barrel-files/avoid-barrel-files': 'structure.reexports',
        'gspot/no-trivial-functions': 'limits.trivial_function_statements',
        'gspot/no-trivial-files': 'structure.reexports',
        'n/file-extension-in-import': 'tools.eslint.import_extension',
    },
};

export const COVERAGE_LINES_SETTING = 'coverage.lines';

export const SWIFT_TARGET_MESSAGE = 'A Swift target with a lower line minimum than coverage.lines needs a reason.';
