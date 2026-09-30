// The swift configuration over a package: the build, the analyzer, and Periphery report their planted defects.
import { plantedCases } from '#tests/support/cli/planted.ts';
import { LIBRARY, SWIFT_PACKAGE } from '#tests/inputs/acceptance/source/kits/swift.ts';

const PAIR = '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n';

// The Swift toolchain checks run on macOS alone.
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
            files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = "three"\n' },
            expected: { file: 'Sources/App/Count.swift', rule: 'compiler', line: 2 },
            platforms: ['darwin'],
            corrected: {
                files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = 3\n' },
            },
        },
        {
            check: 'swift/swiftlint-analyze',
            files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR}` },
            expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
            platforms: ['darwin'],
            corrected: { files: { 'Sources/App/Pair.swift': PAIR } },
        },
        {
            check: 'swift/periphery',
            files: {
                'Sources/App/Pair.swift': `${PAIR}\nprivate func neverCalled() -> Int {\n    count(of: 3)\n}\n\nprivate func count(of size: Int) -> Int {\n    size\n}\n`,
            },
            expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
            platforms: ['darwin'],
            corrected: { files: { 'Sources/App/Pair.swift': PAIR } },
        },
    ],
);
