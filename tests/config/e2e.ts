export const STARTING_FILES = {
    '.editorconfig': `root = true
[*]
indent_size = 2
[*.json]
indent_size = 4
`,
    'prettier.config.mjs':
        'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
    'source.js': 'const greeting="hello";',
    'broken.sh': 'if then\n',
    'authored.txt': 'Preserve this authored file.\n',
    'AGENTS.md': '# Team notes\n',
    'CLAUDE.md': `# Claude notes

Run the tests.
`,
} as const;

export const SHELLCHECK_SYNTAX_FINDINGS = [
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 1,
        rule: 'SC1073',
        message: "Couldn't parse this if expression. Fix to allow more checks.",
        fixable: false,
    },
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 8,
        rule: 'SC1072',
        message: 'Unexpected keyword/token. Fix any mentioned problems and try again.',
        fixable: false,
    },
] as const;

export const PLUGIN_TYPES_SOURCE = `
import plugin from '@gspothq/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['import-boundaries'];
console.log(configs, rule);
`;

export const PLUGIN_PACKED_FILES = ['README.md', 'dist/plugin.js', 'package.json', 'plugin.d.ts'] as const;

export const PROSE_CHECK = {
    check: 'prose/vale',
    files: {
        'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on 03/04/2026.
`,
    },
    corrected: {
        files: {
            'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on March 4, 2026.
`,
        },
    },
    expected: { file: 'guide.md', line: 3, rule: 'gspot.dates' },
} as const;

export const SWIFT_CHECK = {
    check: 'naming/identifiers',
    files: { 'Account.swift': 'let utils = 1\n' },
    corrected: { files: { 'Account.swift': 'let account = 1\n' } },
    expected: { file: 'Account.swift', line: 1, rule: 'banned-word' },
} as const;

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
