// The literal values acceptance/source/configurations/swift reads: names, patterns, limits, and tables.
import type { FindingCase } from '#tests/types/cli.ts';

export const SWIFT_PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';
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
