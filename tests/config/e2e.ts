// cli
export const SWIFT_CHECK = {
    check: 'naming/identifiers',
    files: { 'Account.swift': 'let utils = 1\n' },
    corrected: { files: { 'Account.swift': 'let account = 1\n' } },
    expected: { file: 'Account.swift', line: 1, rule: 'banned-word' },
} as const;

// eslint plugin
export const PLUGIN_TYPES_SOURCE = `
import plugin from '@gspothq/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['import-boundaries'];
console.log(configs, rule);
`;

// quickstart
export const PYTHON_TUTORIAL = {
    folder: 'orders-python',
    firstCheckCode: 0,
    projectCommands: [
        ['mise', 'exec', '--', 'uv', 'init', '--lib'],
        ['mise', 'exec', '--', 'uv', 'sync'],
    ],
    files: {
        'src/orders_python/__init__.py': `__all__ = ["hello"]


def hello() -> str:
    return "Hello from orders-python!"
`,
    },
    sourcePath: 'src/orders_python/__init__.py',
    invalidSource: 'VALUE = eval("1 + 1")\n',
    check: 'python/ruff',
    rule: 'S307',
    line: 1,
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
