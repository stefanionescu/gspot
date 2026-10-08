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

export const SWIFT_LINE_ENDINGS = [['lf'], ['crlf']] as const;
