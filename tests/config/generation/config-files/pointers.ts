export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;

export const XCTEST_POINTER_CASES = [
    {
        scope: '',
        pointers: {
            '.swiftlint.yml': { parent_config: './.gspot/configurations/language/swift/swiftlint.yml' },
            'AppTests/.swiftlint.yml': {
                parent_config: '../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
            'ChildTests/.swiftlint.yml': {
                parent_config: '../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
        },
    },
    {
        scope: 'ios # app',
        pointers: {
            'ios # app/.swiftlint.yml': { parent_config: '../.gspot/configurations/language/swift/swiftlint.yml' },
            'ios # app/AppTests/.swiftlint.yml': {
                parent_config: '../../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
            'ios # app/ChildTests/.swiftlint.yml': {
                parent_config: '../../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
        },
    },
    {
        scope: 'AppTests',
        pointers: {
            'AppTests/.swiftlint.yml': {
                parent_config: '../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
            'AppTests/ChildTests/.swiftlint.yml': {
                parent_config: '../../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
        },
    },
    {
        scope: 'AppTests/Helpers',
        pointers: {
            'AppTests/Helpers/.swiftlint.yml': {
                parent_config: '../../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
            'AppTests/Helpers/ChildTests/.swiftlint.yml': {
                parent_config: '../../../.gspot/configurations/language/swift/swiftlint.yml',
                disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
            },
        },
    },
] as const;

export const DEFAULT_EXPORT = { location: 'the requested module' } as const;
