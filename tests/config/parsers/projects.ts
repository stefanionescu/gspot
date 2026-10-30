import { GROUPED_PBXPROJ } from '#tests/config/checks/infrastructure/infrastructure.ts';

export const SWIFT_DEPENDENCY_CALLS = `import PackageDescription
let package = Package(
    dependencies: [
        .package(url: "https://example.com/live.git", from: "1.0.0"),
        /* .package(url: "https://example.com/removed.git", from: "1.0.0") */
        .package(path: "../local")
    ],
    targets: [
        .binaryTarget(name: "Vendor", url: "https://example.com/Vendor.xcframework.zip", checksum: "abc")
    ]
)
let example = """
.package(url: "https://example.com/documentation.git", from: "1.0.0")
"""
`;

export const LOCKED_VERSION_CASES = [
    {
        name: 'npm root',
        file: 'package-lock.json',
        folder: '',
        text: '{"packages":{"":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}},"node_modules/react":{"version":"18.3.1"},"node_modules/react-dom":{"version":"18.3.1"},"node_modules/old-chart/node_modules/react":{"version":"17.0.2"}}}',
    },
    {
        name: 'npm workspace',
        file: 'package-lock.json',
        folder: 'app',
        text: '{"packages":{"":{"dependencies":{"react":"17.0.2"}},"app":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}},"node_modules/react":{"version":"17.0.2"},"app/node_modules/react":{"version":"18.3.1"},"node_modules/react-dom":{"version":"18.3.1"}}}',
    },
    {
        name: 'Bun root',
        file: 'bun.lock',
        folder: '',
        text: '{"workspaces":{"":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}},"packages":{"react":["react@18.3.1"],"react-dom":["react-dom@18.3.1"],"old-chart/react":["react@17.0.2"]}}',
    },
    {
        name: 'Bun workspace',
        file: 'bun.lock',
        folder: 'app',
        text: '{"workspaces":{"":{"dependencies":{"react":"17.0.2"}},"app":{"name":"web","dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}},"packages":{"react":["react@17.0.2"],"web/react":["react@18.3.1"],"react-dom":["react-dom@18.3.1"]}}',
    },
    {
        name: 'pnpm workspace',
        file: 'pnpm-lock.yaml',
        folder: 'app',
        text: 'importers:\n  .:\n    dependencies:\n      react: {specifier: 17.0.2, version: 17.0.2}\n  app:\n    dependencies:\n      react: {specifier: ^18.3.0, version: 18.3.1}\n    devDependencies:\n      react-dom: {specifier: 18.3.1, version: 18.3.1(react@18.3.1)}\npackages:\n  react@17.0.2: {}\n  react@18.3.1: {}\n  react-dom@18.3.1: {}\n',
    },
    {
        name: 'Yarn classic',
        file: 'yarn.lock',
        folder: '',
        text: '# yarn lockfile v1\n\n"react@^18.0.0", "react@^18.3.0":\n  version "18.3.1"\n"react@17.0.2":\n  version "17.0.2"\n"react-dom@18.3.1":\n  version "18.3.1"\n',
    },
    {
        name: 'Yarn Berry workspace',
        file: 'yarn.lock',
        folder: 'app',
        text: '__metadata:\n  version: 8\n"react@npm:^18.0.0, react@npm:^18.3.0":\n  version: 18.3.1\n"react@npm:17.0.2":\n  version: 17.0.2\n"react-dom@npm:18.3.1":\n  version: 18.3.1\n',
    },
] as const;

export const TSCONFIG_PARSE_ERRORS = [
    {
        name: 'a missing extends package',
        json: '{"extends":"absent-compiler-settings/tsconfig.json"}',
        message:
            'tsconfig.json extends absent-compiler-settings/tsconfig.json, which is not installed. Install the project dependencies, then run the command again.',
    },
    {
        name: 'invalid JSON',
        json: '{',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;

export const XCODE_PROJECT_REFUSALS = [
    {
        name: 'missing value',
        source: GROUPED_PBXPROJ.slice(0, -3),
        message: 'The Xcode project has an invalid string.',
    },
    {
        name: 'unknown object',
        source: GROUPED_PBXPROJ.replace('B1, B2,', 'MISSING, B2,'),
        message: 'The Xcode project references an unknown object: MISSING.',
    },
    {
        name: 'group cycle',
        source: GROUPED_PBXPROJ.replace('children = (F1,);', 'children = (FIRST, F1,);').replace(
            'children = (FIRST, SECOND, ROOT, SYNC,);',
            'children = (SECOND, ROOT, SYNC,);',
        ),
        message: 'The Xcode project contains a group cycle.',
    },
    {
        name: 'unresolved source tree',
        source: GROUPED_PBXPROJ.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;'),
        message: 'Cannot find the folder of Xcode source tree CUSTOM_BUILD_ROOT without build settings.',
    },
] as const;

export const PROJECT_SYNTAX_CASES = [
    { name: 'quoted keys', source: GROUPED_PBXPROJ.replace('rootObject = P;', '"rootObject" = P;') },
    {
        name: 'comments inside arrays',
        source: GROUPED_PBXPROJ.replace(
            'files = (B1, B2,);',
            'files = (B1, /* first source */ B2, // second source\n);',
        ),
    },
] as const;

export const FIRST_GROUP_SWIFT_PATH = '/repo/First Group/Shared.swift';
