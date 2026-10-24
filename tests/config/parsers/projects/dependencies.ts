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
