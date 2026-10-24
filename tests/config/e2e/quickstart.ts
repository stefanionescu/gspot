export const PYTHON_TUTORIAL = {
    folder: 'orders-python',
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
    line: 3,
} as const;

export const SWIFT_TUTORIAL = {
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
    line: 2,
} as const;
