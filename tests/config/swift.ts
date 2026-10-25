export const SWIFT_PACKAGE_HEADER = '// swift-tools-version: 6.0\nimport PackageDescription\n';

export const SWIFT_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

export const SWIFT_LANGUAGE_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example")])
`;
