import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

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
