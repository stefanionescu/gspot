export const SWIFT_PACKAGE_HEADER = '// swift-tools-version: 6.0\nimport PackageDescription\n';

export const SWIFT_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

export const SWIFT_LANGUAGE_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example")])
`;

export const CLEAN_SWIFT = String.raw`import Foundation

/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if person.isEmpty {
        return "hello"
    }
    return "hello \(person)"
}
`;

export const SWIFT_VALUE_SOURCE = 'let value = 1\n';

export const XCTEST_SOURCE = 'import XCTest\n';
