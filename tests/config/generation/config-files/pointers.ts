/** Uniform Resource Identifier delimiters and Unicode must stay literal in module paths. */
export const MODULE_PATHS = ['100%', '#fragment', '?query', "author's", 'café'] as const;

/** The default export of each module that a pointer imports. */
export const MODULE_VALUE = { location: 'the requested module' } as const;

/** Two Markdown scopes: one with the rules of the root, one with its own code block style. */
export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;

/** A scope that removes Swift, so its XCTest folder gets no SwiftLint pointer. */
export const OMITTED_SWIFT_SCOPE =
    '[[scope]]\npath = "omitted"\nremoved_configurations = { value = ["swift"], reason = "This scope does not use Swift or its generated pointers." }\n';

/**
 * Each Swift scope of the pointer test, with every SwiftLint pointer it writes. A pointer row holds its path, the climb
 * from its folder to the repository root, and whether it sits in an XCTest folder.
 */
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
