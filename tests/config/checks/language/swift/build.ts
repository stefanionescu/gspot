export const SWIFT_LANGUAGE_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example")])
`;

export const SWIFT_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

export const PRIVATE_OTHER_FINDING = {
    file: '/var/folders/project/Other.swift',
    line: 5,
    column: 3,
    rule: 'compiler',
    message: 'Unknown name',
} as const;

export const PRIVATE_MAIN_FINDING = {
    file: '/var/folders/project/Main.swift',
    line: 4,
    column: 2,
    rule: 'compiler',
    message: 'Missing value',
} as const;

export const FAILED_BUILD_FINDINGS = [
    {
        check: 'swift/build',
        file: 'Main.swift',
        line: 4,
        column: 2,
        rule: 'compiler',
        message: 'Missing value',
        fixable: false,
        help: 'Fix the first compiler error; later ones often come from the same mistake.',
    },
] as const;

export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, message: 'Cannot analyze Swift because the build exited 7.' },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: 'The swiftlint command failed (exit 7): The tool printed no error output.',
    },
] as const;

export const SWIFT_REPLACEMENT_CASES = [
    { checkId: 'swift/build', rule: 'compiler' },
    { checkId: 'swift/swiftlint-analyze', rule: 'analyzer' },
    { checkId: 'swift/periphery', rule: 'unused' },
] as const;
