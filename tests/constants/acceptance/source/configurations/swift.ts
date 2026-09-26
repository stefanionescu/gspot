// The literal values acceptance/source/configurations/swift reads: names, patterns, limits, and tables.
import type { FindingCase } from '#tests/types/support/cli.ts';

export const SWIFT_PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';
export const FORWARD =
    'import Foundation\n\n/// Builds the greeting for a person.\nfunc welcome(for name: String) -> String {\n    return greeting(for: name)\n}\n';
export const TINY =
    'import Foundation\n\nprivate func doubled(_ count: Int) -> Int {\n    count * 2\n}\n\n/// The size of a pair.\nfunc pairSize(of count: Int) -> Int {\n    let size = doubled(count)\n    return size + 1\n}\n';
export const BODY =
    '    let first = name.uppercased()\n    let second = first.lowercased()\n    let third = second + first\n    return third\n';
export const COPIES = `import Foundation\n\n/// One way to mix a name.\nfunc mixed(_ name: String) -> String {\n${BODY}}\n\n/// The same way again.\nfunc blended(_ name: String) -> String {\n${BODY}}\n`;
export const BELOW =
    'import Foundation\n\n/// The limit other files read.\nlet sharedLimit = 3\n\nprivate let localLimit = 2\n\n/// Adds the two limits.\nfunc bothLimits() -> Int {\n    sharedLimit + localLimit\n}\n';
export const SWITCHED =
    'import Foundation\n\nprivate func label(_ count: Int) -> String {\n    switch count {\n    case 0:\n        "none"\n    case 1:\n        "one"\n    default:\n        "many"\n    }\n}\n\n/// The label of a pair.\nfunc pairLabel() -> String {\n    let text = label(2)\n    return text + "!"\n}\n';
export const NEGATED =
    'import Foundation\n\n/// Whether a name is new.\nfunc isNew(_ name: String) -> Bool {\n    !["a", "b"].contains(name)\n}\n';
export const STRUCTURAL: FindingCase[] = [
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Label.swift': SWITCHED },
        expected: { file: 'Sources/App/Label.swift', rule: 'trivial-function', line: 15 },
    },
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Fresh.swift': NEGATED },
        expected: { file: 'Sources/App/Fresh.swift', rule: 'trivial-function', line: 4 },
    },
];
export const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
