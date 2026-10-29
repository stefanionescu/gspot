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

export const PARAMETER_LIMIT_CASE = {
    language: 'swift',
    file: 'example.swift',
    source: `internal func seven(
    value0: Int = 0,
    value1: Int = 0,
    value2: Int = 0,
    value3: Int = 0,
    value4: Int = 0,
    value5: Int = 0,
    value6: Int = 0
) -> Int {
    return value0 + value1 + value2 + value3 + value4 + value5 + value6
}

internal func eight(
    value0: Int = 0,
    value1: Int = 0,
    value2: Int = 0,
    value3: Int = 0,
    value4: Int = 0,
    value5: Int = 0,
    value6: Int = 0,
    value7: Int = 0
) -> Int {
    return value0 + value1 + value2 + value3 + value4 + value5 + value6 + value7
}
`,
    finding: { rule_id: 'function_parameter_count', line: 13 },
    failureStatus: 2,
} as const;
