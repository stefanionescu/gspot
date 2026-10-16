import { NPM_CHECK_IGNORES } from '#tests/data/test-setup.ts';

export const SWIFT_PROJECT_SELECTION_CASES = [
    {
        name: 'keeps an inherited authored project origin',
        scope: 'app',
        tables: `[[scope]]
path = "app"

[swift]
xcode_project = "Root.xcodeproj"
xcode_scheme = "App"

`,
        files: { 'Root.xcodeproj/project.pbxproj': '', 'app/Child.xcodeproj/project.pbxproj': '' },
        project: 'Root.xcodeproj',
        argument: '../Root.xcodeproj',
    },
    {
        name: 'keeps a scoped authored workspace',
        scope: 'app',
        tables: `[[scope]]
path = "app"
swift = { xcode_project = "app/Choice.xcworkspace", xcode_scheme = "App" }
`,
        files: { 'app/Child.xcodeproj/project.pbxproj': '', 'app/Choice.xcworkspace/contents.xcworkspacedata': '' },
        project: 'app/Choice.xcworkspace',
        argument: 'Choice.xcworkspace',
    },
] as const;

export const SWIFT_BUILD_PURPOSES = [
    { purpose: 'compile', check: 'swift/build' },
    { purpose: 'analyze', check: 'swift/swiftlint-analyze' },
    { purpose: 'coverage', check: 'swift-tests/coverage' },
] as const;

/** SwiftFormat stays active when an ignore skips both other external Swift checks. */
export const SWIFT_FORMAT_SETTINGS = `configurations = ["swift"]
${NPM_CHECK_IGNORES}[[ignore]]
check = "swift/swiftlint"
reason = "SwiftFormat owns this sandbox's formatting."
[[ignore]]
check = "swift/swiftlint-analyze"
reason = "This sandbox has no analyzer build log."
[[ignore]]
check = "swift/periphery"
reason = "This sandbox has no Xcode project."
[rules]
enabled = false
`;

/** Root and nested native package headers determine their own formatter versions. */
export const SWIFT_VERSION_FILES = {
    'gspot.toml': `configurations = ["swift"]
[[scope]]
path = "nested"

configurations = ["swift"]
`,
    'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\n',
    'nested/Package.swift': '// swift-tools-version:6.3.2\nimport PackageDescription\n',
} as const;

export const SWIFT_PROJECT_SETTINGS = `configurations = ["swift", "xcode"]
[[scope]]
path = "nested"
swift = {xcode_project = "nested/Chosen.xcodeproj"}
[[scope]]
path = "disabled"
removed_configurations = ["swift"]

[swift]
xcode_project = "Chosen.xcodeproj"
xcode_destination = "custom root destination"
`;

export const SWIFT_LANGUAGE_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example")])
`;

export const SWIFT_VALUE_SOURCE = 'public let value: Int = 1\n';

export const SWIFT_VALUE_ERROR = 'public let value: Int = "wrong"\n';

export const SWIFT_FORMAT_CHECK = ['check', '--only', 'swift/swiftformat', '--json'];
