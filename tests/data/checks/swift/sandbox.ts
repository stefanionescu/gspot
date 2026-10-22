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

/** A Swift sandbox that holds one function every check accepts. */
export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;

export const PAIR_SIZE_SOURCE = `/// The size of a pair.
public func pairSize(of count: Int) -> Int {
    count * 2
}
`;

export const SWIFT_PACKAGE_HEADER = '// swift-tools-version: 6.0\nimport PackageDescription\n';
