export const SAMPLE = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';

export const CORRECT =
    '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';
