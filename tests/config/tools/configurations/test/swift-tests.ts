export const XCTEST_COVERAGE_SOURCE =
    'func first() -> Int {\n    return 1\n}\nfunc second() -> Int {\n    return 2\n}\n';

export const XCTEST_COVERAGE_TESTS =
    'import XCTest\nfinal class ValueTests: XCTestCase {\n    func testValues() {\n        XCTAssertEqual(first(), 1)\n    }\n}\n';

export const SAMPLE = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';

export const CORRECT =
    '/// Parses a sample value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';

export const XCTEST_SCOPES = [
    { name: 'at the root', scope: '' },
    { name: 'in a scope whose path has a space and #', scope: 'ios # app' },
];

export const XCTEST_COMMAND = ['check', '--only', 'swift/swiftlint', '--json'];
