// The swift configuration over a package: the build, the analyzer, and Periphery report their planted defects.
import { onMac } from '#tests/harness/cli/platforms.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

const SWIFT_PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';

const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';

const PAIR = '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n';

// The Swift toolchain checks run on macOS alone, so no other system installs the package.
if (onMac)
    plantedCases(
        'the swift configuration over a package',
        {
            kits: ['swift', 'naming'],
            modules: false,
            without: ['spelling'],
            tools: ['swiftlint', 'swiftformat', 'periphery'],
            files: { '.gitignore': '.build\n', 'Package.swift': SWIFT_PACKAGE, 'Sources/App/Greeting.swift': LIBRARY },
        },
        [
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
        ],
    );
