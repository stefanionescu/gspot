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
        check: 'swift/swiftlint',
        files: { 'Sources/App/Cast.swift': CAST_SWIFT },
        expected: { file: 'Sources/App/Cast.swift', rule: 'force_cast', line: 5 },
        corrected: {
            files: {
                'Sources/App/Cast.swift': `import Foundation

/// Reads a value as text.
public func text(from value: Any) -> NSString? {
    value as? NSString
}
`,
            },
        },
    },
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

// The test Swift functions: one every check accepts, and one SwiftLint reports.
/** A clean function that every Swift check accepts. */

export const SWIFT_SANDBOX = {
    configurations: ['swift', 'naming'],

    tools: ['swiftlint', 'swiftformat'],
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
