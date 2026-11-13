// bash scripts
export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;
export const BROKEN_IF_SCRIPT = 'if then\n';
export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    printf '%s\\n' "\${greeting}"
}

main "$@"
`;

// javascript sources
export const EMPTY_DEFAULT_SOURCE = 'export default {};\n';
export const GREETING_SOURCE = 'const greeting="hello";';
export const TERMS_SOURCE = 'export default function Terms() { return null; }\n';

// python projects
export const APP_PYPROJECT = '[project]\nname = "app"\nversion = "1.0.0"\n';
const PYDOCLINT_GOOGLE = `[tool.pydoclint]
style = "google"
`;
const PYTHON_PROJECT_OPTIONS = `requires-python = ">=3.12"
dependencies = []
`;
export const PYPROJECT = `[project]
name = "example"
version = "1.0.0"
${PYTHON_PROJECT_OPTIONS}`;
export const GOOGLE_PYPROJECT = `${PYPROJECT}\n${PYDOCLINT_GOOGLE}`;

// swift sources
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
export const SWIFT_PACKAGE_HEADER = '// swift-tools-version: 6.0\nimport PackageDescription\n';
export const SWIFT_LANGUAGE_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example")])
`;
export const SWIFT_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;
export const SWIFT_VALUE_SOURCE = 'let value = 1\n';
export const XCTEST_SOURCE = 'import XCTest\n';

// typescript options
export const STRICT_TYPE_FLAGS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;
export const STRICT_COMPILER_OPTIONS = {
    ...STRICT_TYPE_FLAGS,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

// workspaces
export const UNCLOSED_PACKAGES = 'packages: [';

// xcode targets
export const NAMED_TARGET_SOURCE = 'T = {isa = PBXNativeTarget; name = "App Kit";';
export const NATIVE_TARGET_SOURCE = 'T = {isa = PBXNativeTarget;';
