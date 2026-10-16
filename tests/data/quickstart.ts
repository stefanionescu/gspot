/** Setup commands and expected statuses shared by both unformatted tutorial scaffolds. */
export const QUICKSTART_COMMANDS = [
    { command: ['mise', 'exec', '--', 'gspot', 'install'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'check'], code: 1 },
    { command: ['mise', 'exec', '--', 'gspot', 'check', '--fix'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'check'], code: 0 },
] as const;

export const TUTORIALS = [
    {
        configuration: 'python',
        folder: 'orders-python',
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
    },
    {
        configuration: 'swift',
        folder: 'orders-swift',
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
    },
] as const;
