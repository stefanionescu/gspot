/** The calculation and test pasted into the Swift tutorial. */
export const SOURCE = 'public func total(_ values: [Int]) -> Int {\n    values.reduce(0, +)\n}\n';
export const TESTS =
    'import Testing\n@testable import orders_swift\n\n@Test func totalsValues() {\n    #expect(total([1, 2, 3]) == 6)\n}\n';

/** The forced cast pasted into the Swift tutorial. */
export const INVALID_SOURCE = 'public func total(_ value: Any) -> Int {\n    value as! Int\n}\n';

/** Arguments for initializing the tutorial with its explicit configuration. */
export const INITIALIZE = ['gspot', 'init', '--yes', '--configurations', 'swift'];

/** The source restored after the rejected commit. */
export const SOURCE_PATH = 'Sources/orders-swift/orders_swift.swift';
