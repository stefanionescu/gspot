import { NPM_CHECK_IGNORES } from '#tests/data/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

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

/** The swift-tools-version header of each package sets the Swift version its formatter uses. */
export const SWIFT_VERSION_FILES = {
    'gspot.toml': buildSandboxSettings(['swift'], {
        rules: true,
        scopes: [{ path: 'nested', configurations: ['swift'] }],
    }),
    'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\n',
    'nested/Package.swift': '// swift-tools-version:6.3.2\nimport PackageDescription\n',
} as const;
export const SWIFT_PROJECT_SETTINGS = `configurations = ["swift", "xcode"]
[[scope]]
path = "nested"
swift = {xcode_project = "nested/Chosen.xcodeproj"}
[[scope]]
path = "disabled"
removed_configurations = { value = ["swift"], reason = "This scope does not build Swift projects." }

[swift]
xcode_project = "Chosen.xcodeproj"
xcode_destination = "custom root destination"
`;
