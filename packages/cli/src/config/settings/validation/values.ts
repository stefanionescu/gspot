export const SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    eslint: {
        'sonarjs/no-identical-functions': 'duplication.min_lines',
        'no-restricted-imports': 'tools.eslint.restricted_imports',
        'gspot/import-boundaries': '[[import_rule]]',
        'barrel-files/avoid-barrel-files': 'structure.reexports',
        'gspot/no-trivial-functions': 'limits.trivial_function_statements',
        'gspot/no-trivial-files': 'structure.reexports',
        'n/file-extension-in-import': 'tools.eslint.import_extension',
    },
    markdownlint: { MD007: 'format.indent_width' },
};
