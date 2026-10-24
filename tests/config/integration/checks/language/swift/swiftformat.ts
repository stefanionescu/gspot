export const INLINE_COMMENT_FINDINGS = [
    [4, 'blockComments'],
    [4, 'docComments'],
    [5, 'blankLinesBetweenScopes'],
    [7, 'blockComments'],
    [7, 'docComments'],
    [8, 'blockComments'],
    [8, 'docComments'],
    [11, 'blockComments'],
] as const;

export const FORMATTED_INLINE_DOCS = `/// A choice.
public enum Choice {
    /// The first choice.
    case one // Inline documentation.
}

/// A literal.
public let example = "/** literal */" // After a string.
/** Ordinary comment. */ // After a comment.
/// An inline /** example */ remains documentation.
public let value = "safe"
// Ordinary* nested comment.
// swiftformat:disable:next blockComments - An external declaration retains its layout.
/** A retained declaration. */
public let preserved = "fixed"
`;

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

export const SOURCE_HEADER = `// Greeting.swift
// Created by Alex Garcia.
// Copyright 2026 Example Contributors.

`;

export const FORMATTED_DOCS_SOURCE = `/// Parses a sample value.
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}

/// The literal /** example */ is documentation syntax.
public let example = "/** not documentation */"

// Ordinary comment with a nested* comment inside.
`;
