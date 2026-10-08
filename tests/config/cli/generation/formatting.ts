import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';

/** Inventory declarations and check path ignores reach native Prettier patterns. */
export const IGNORE_POLICY = {
    configurations: ['format', 'javascript'],
    exclude: ['excluded/**'],
    generated: [{ paths: ['generated/**'], reason: 'A checked-in generator produces these sources.' }],
    vendored: [{ paths: ['vendored/**'], reason: 'The upstream package owns these sources.' }],
    ignore: [
        {
            check: 'format/prettier',
            paths: ['authored/omitted.ts'],
            reason: 'This output retains its authored layout.',
        },
    ],
};

/** Real authored files stay eligible while declarations, ordinary excludes, and consumable lockfiles stay ignored. */
export const IGNORE_CASES = [
    { file: 'tests/build/Scenario.ts', ignored: false },
    { file: 'src/dist/source.ts', ignored: false },
    { file: 'coverage/source.ts', ignored: false },
    { file: 'build/source.ts', ignored: false },
    { file: 'excluded/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'vendored/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'package-lock.json', ignored: true },
    { file: 'pnpm-lock.yaml', ignored: true },
];

export const SVELTE_PLUGIN: PrettierPlugin = {
    name: 'prettier-plugin-svelte',
    entry: 'plugin.js',
    overrides: [{ files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } }],
};

/** Root and nested native package headers determine their own formatter versions. */
export const SWIFT_VERSION_FILES = {
    'gspot.toml': 'configurations = ["swift"]\n[scope."nested"]\nconfigurations = ["swift"]\n',
    'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\n',
    'nested/Package.swift': '// swift-tools-version:6.3.2\nimport PackageDescription\n',
};

/** Native project metadata follows manual root and scope choices, including explicit empty paths. */
export const SWIFT_PROJECT_POLICY = `configurations = ["swift", "xcode"]
[swift]
xcode_project = "Chosen.xcodeproj"
xcode_destination = "custom root destination"
[scope."nested"]
[scope."nested".swift]
xcode_project = "Chosen.xcodeproj"
xcode_destination = ""
[scope."disabled"]
[scope."disabled".swift]
xcode_project = ""
`;

export const LANGUAGE_IGNORES = [
    {
        name: 'Python without JavaScript',
        policy: 'configurations = ["format", "markdown", "python"]\n',
        ignored: ['.venv/', 'uv.lock'],
        absent: ['node_modules/', 'package-lock.json', '.build/', 'Package.resolved'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'Swift without JavaScript',
        policy: 'configurations = ["format", "markdown", "swift"]\n',
        ignored: ['.build/', 'DerivedData/', 'Pods/', 'Package.resolved'],
        absent: ['node_modules/', 'package-lock.json', '.venv/', 'uv.lock'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'JavaScript',
        policy: 'configurations = ["format", "markdown", "javascript"]\n',
        ignored: ['node_modules/', 'package-lock.json', 'pnpm-lock.yaml'],
        absent: ['.build/', 'Package.resolved', '.venv/', 'uv.lock'],
        pointer: true,
        markdownPointer: '.markdownlint-cli2.mjs',
    },
    {
        name: 'a JavaScript child of Python',
        policy: 'configurations = ["format", "markdown", "python"]\n[scope.web]\nconfigurations = ["javascript"]\n',
        ignored: ['.venv/', 'uv.lock', 'web/node_modules/', 'web/package-lock.json'],
        absent: ['node_modules/', 'package-lock.json', '.build/', 'Package.resolved'],
        pointer: true,
        markdownPointer: 'web/.markdownlint-cli2.mjs',
    },
];
