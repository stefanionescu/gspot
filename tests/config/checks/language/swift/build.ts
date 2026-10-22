export const SWIFT_LANGUAGE_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example")])
`;

export const SWIFT_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

/** The SwiftLint config files of a nested scope. */
export const NESTED_SWIFTLINT_FILES = [
    '.gspot/configurations/language/swift/swiftlint.yml',
    'app/.swiftlint.yml',
    'app/Sources/.swiftlint.yml',
    'app/Sources/Feature/.swiftlint.yml',
] as const;

/** The Other.swift diagnostic without the /private prefix. */
export const PRIVATE_OTHER_FINDING = {
    file: '/var/folders/project/Other.swift',
    line: 5,
    column: 3,
    rule: 'compiler',
    message: 'Unknown name',
} as const;

/** The Main.swift diagnostic without the /private prefix. */
export const PRIVATE_MAIN_FINDING = {
    file: '/var/folders/project/Main.swift',
    line: 4,
    column: 2,
    rule: 'compiler',
    message: 'Missing value',
} as const;

/** The swift/build finding after a failed build. */
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

/** The two analyzer exits, with the exact message of each. */
export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, message: /build exited 7/u },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: /^The swiftlint command failed \(exit 7\): The tool printed no error output\.$/u,
    },
] as const;

/** Compiler stderr that names one source under /private/var/folders and one under /var/folders. */
export const PRIVATE_PREFIX_STDERR =
    '/private/var/folders/project/Main.swift:4:2: error: Missing value\n/var/folders/project/Other.swift:5:3: error: Unknown name';
