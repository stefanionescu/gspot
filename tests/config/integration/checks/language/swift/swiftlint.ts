export const PARSER_SOURCE = `public func parsed(_ value: String) -> Int {
    Int(value)! + 42
}
`;

export const CORRECTED_PARSER_SOURCE = `/// Parses a sample value.
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}
`;

export const XCTEST_SCOPES = [
    { name: 'at the root', scope: '' },
    { name: 'in a scope whose path has a space and #', scope: 'ios # app' },
] as const;

export const CAST_SWIFT = `import Foundation

/// Reads a value as text.
public func text(from value: Any) -> NSString {
    value as! NSString
}
`;
