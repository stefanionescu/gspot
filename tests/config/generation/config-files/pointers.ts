export const MODULE_PATHS = ['100%', '#fragment', '?query', "author's", 'café'] as const;

export const MODULE_VALUE = { location: 'the requested module' } as const;

export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;

export const OMITTED_SWIFT_SCOPE =
    '[[scope]]\npath = "omitted"\nremoved_configurations = { value = ["swift"], reason = "This scope does not use Swift or its generated pointers." }\n';

export const XCTEST_POINTER_CASES = [
    {
        scope: '',
        pointers: [
            ['.swiftlint.yml', './', false],
            ['AppTests/.swiftlint.yml', '../', true],
            ['ChildTests/.swiftlint.yml', '../', true],
        ],
    },
    {
        scope: 'ios # app',
        pointers: [
            ['ios # app/.swiftlint.yml', '../', false],
            ['ios # app/AppTests/.swiftlint.yml', '../../', true],
            ['ios # app/ChildTests/.swiftlint.yml', '../../', true],
        ],
    },
    {
        scope: 'AppTests',
        pointers: [
            ['AppTests/.swiftlint.yml', '../', true],
            ['AppTests/ChildTests/.swiftlint.yml', '../../', true],
        ],
    },
    {
        scope: 'AppTests/Helpers',
        pointers: [
            ['AppTests/Helpers/.swiftlint.yml', '../../', true],
            ['AppTests/Helpers/ChildTests/.swiftlint.yml', '../../../', true],
        ],
    },
] as const;
