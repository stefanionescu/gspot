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
            '.swiftlint.yml': { parent: './.gspot/configurations/language/swift/swiftlint.yml', overrides: false },
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'ChildTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'ios # app',
        pointers: {
            'ios # app/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: false,
            },
            'ios # app/AppTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'ios # app/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'AppTests',
        pointers: {
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'AppTests/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'AppTests/Helpers',
        pointers: {
            'AppTests/Helpers/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'AppTests/Helpers/ChildTests/.swiftlint.yml': {
                parent: '../../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
] as const;

export const DEFAULT_EXPORT = { location: 'the requested module' } as const;
