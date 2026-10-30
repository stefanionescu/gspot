export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;

export const XCTEST_LINK_FILE_CASES = [
    {
        scope: '',
        linkFiles: {
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
        linkFiles: {
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
        linkFiles: {
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
        linkFiles: {
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
