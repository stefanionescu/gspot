import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const SWIFT_PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';

export const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';

export const PAIR = '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n';

export const REPOSITORY: InstalledScenario = {
    configurations: ['swift', 'naming'],

    tools: ['swiftlint', 'swiftformat', 'periphery'],
    files: { '.gitignore': '.build\n', 'Package.swift': SWIFT_PACKAGE, 'Sources/App/Greeting.swift': LIBRARY },
};

export const CASES: FindingCase[] = [
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
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR } },
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift': `${PAIR}\nprivate func neverCalled() -> Int {\n    count(of: 3)\n}\n\nprivate func count(of size: Int) -> Int {\n    size\n}\n`,
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR } },
    },
];
