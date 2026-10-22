/** The line and column of each inline block comment that SwiftFormat reports. */
export const INLINE_COMMENT_POSITIONS: number[][] = [
    [4, 1],
    [7, 1],
    [8, 1],
    [11, 1],
];
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
