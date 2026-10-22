/** The Python quickstart: uv starts a clean library, and Ruff reports the syntax error. */
export const PYTHON_TUTORIAL = {
    configuration: 'python',
    folder: 'orders-python',
    // uv init writes double quotes, which Ruff keeps, so the new project starts clean.
    firstCheckCode: 0,
    projectCommands: [
        ['uv', 'init', '--lib'],
        ['uv', 'sync'],
    ],
    files: {},
    sourcePath: 'src/orders_python/__init__.py',
    invalidSource: 'def total(items):\n    return sum(items\n',
    check: 'python/ruff',
    rule: 'invalid-syntax',
    message: 'unexpected EOF while parsing',
} as const;

/** The Swift quickstart: SwiftPM starts a library, and SwiftLint reports the force cast. */
export const SWIFT_TUTORIAL = {
    configuration: 'swift',
    folder: 'orders-swift',
    firstCheckCode: 1,
    projectCommands: [['swift', 'package', 'init', '--type', 'library']],
    files: {
        'Sources/orders-swift/orders_swift.swift': `public func total(_ values: [Int]) -> Int {
values.reduce(0, +)
}
`,
        'Tests/orders-swiftTests/orders_swiftTests.swift': `import Testing
@testable import orders_swift

@Test func totalsValues() {
#expect(total([1, 2, 3]) == 6)
}
`,
    },
    sourcePath: 'Sources/orders-swift/orders_swift.swift',
    invalidSource: `public func total(_ value: Any) -> Int {
value as! Int
}
`,
    check: 'swift/swiftlint',
    rule: 'force_cast',
    message: 'Force casts should be avoided',
} as const;
