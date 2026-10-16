import { PAIR_SIZE_SOURCE } from '#tests/data/checks/swift/lint.ts';

export const SWIFT_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

export const SWIFT_PACKAGE_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: {
        '.gitignore': '.build\nnode_modules/\n',
        'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "App",
    products: [.library(name: "App", targets: ["App"])],
    targets: [.target(name: "App")]
)
`,
        'Sources/App/Greeting.swift': String.raw`/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    "hello \(name)"
}
`,
    },
} as const;

export const SWIFT_PACKAGE_CASES = [
    {
        check: 'swift/build',
        files: {
            'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = "three"\n',
        },
        expected: { file: 'Sources/App/Count.swift', rule: 'compiler', line: 2 },
        corrected: {
            files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = 3\n' },
        },
    },
    {
        check: 'swift/swiftlint-analyze',
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR_SIZE_SOURCE}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift': `${PAIR_SIZE_SOURCE}
private func neverCalled() -> Int {
    count(of: 3)
}

private func count(of size: Int) -> Int {
    size
}
`,
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
] as const;
