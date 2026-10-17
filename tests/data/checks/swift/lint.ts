/** A force cast SwiftLint reports. */
export const CAST_SWIFT = `import Foundation

/// Reads a value as text.
public func text(from value: Any) -> NSString {
    value as! NSString
}
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

export const SWIFT_CASES = [
    // SwiftLint has no Windows build.
    {
        check: 'swift/swiftformat',
        files: {
            'Sources/App/Greeting.swift': String.raw`import Foundation

/// Builds the greeting for a person.
public  func greeting(for name: String) -> String {
    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if person.isEmpty {
        return "hello"
    }
    return "hello \(person)"
}
`,
        },
        corrected: { files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT } },
        expected: { file: 'Sources/App/Greeting.swift', rule: 'consecutiveSpaces', line: 4 },
    },
] as const;

/** A Swift sandbox that holds one function every check accepts. */
export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;

export const SWIFT_DOCS_SOURCE = `/** Parses a sample value. */
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}

/// The literal /** example */ is documentation syntax.
public let example = "/** not documentation */"

/* Ordinary comment with a nested /** comment */ inside. */
`;

export const SWIFT_INLINE_DOCS = `/// A choice.
public enum Choice {
    /// The first choice.
    case one /** Inline documentation. */
}
/// A literal.
public let example = "/** literal */" /** After a string. */
/* Ordinary comment. */ /** After a comment. */
/// An inline /** example */ remains documentation.
public let value = "safe"
/* Ordinary /** nested */ comment. */
// swiftformat:disable:next blockComments - An external declaration retains its layout.
/** A retained declaration. */
public let preserved = "fixed"
`;

export const PAIR_SIZE_SOURCE = `/// The size of a pair.
public func pairSize(of count: Int) -> Int {
    count * 2
}
`;

export const SOURCE_HEADER = `// Greeting.swift
// Created by Alex Garcia.
// Copyright 2026 Example Contributors.

`;
