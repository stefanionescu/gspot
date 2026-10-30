export const SWIFT_PACKAGE_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: {
        '.gitignore': '.build\nnode_modules/\n',
        'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "App",
    products: [.library(name: "App", targets: ["App"])],
    targets: [.target(name: "App")]
)
`,
        'Sources/App/Greeting.swift': String.raw`/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    "hello \(name)"
}
`,
    },
} as const;

const PAIR_SIZE_SOURCE = `/// The size of a pair.
public func pairSize(of count: Int) -> Int {
    count * 2
}
`;

export const SWIFT_PACKAGE_CASES = [
    {
        check: 'swift/swiftlint-analyze',
        tool: 'swiftlint',
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR_SIZE_SOURCE}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
    {
        check: 'swift/periphery',
        tool: 'periphery',
        files: {
            'Sources/App/Pair.swift': `${PAIR_SIZE_SOURCE}
private func neverCalled() -> Int {
    3
}
`,
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
] as const;

export const XCODE_TOOL_PROJECT = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1, G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F2,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = main.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = Example; explicitFileType = "compiled.mach-o.executable"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Example; productName = Example; productReference = F2; productType = "com.apple.product-type.tool"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Example; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; }; };
 };
}
`;

export const XCTEST_COVERAGE_SOURCE = `func first() -> Int {
    return 1
}
func second() -> Int {
    return 2
}
`;

export const XCTEST_COVERAGE_TESTS = `import XCTest
final class ValueTests: XCTestCase {
    func testValues() {
        XCTAssertEqual(first(), 1)
    }
}
`;

export const COVERAGE_TARGET_SETTINGS = {
    tables: `[[coverage.swift_target]]
name = "Inspection.xctest"
lines = 100

[swift]
xcode_project = "Inspection.xcodeproj"
xcode_scheme = "Inspection"
xcode_destination = "platform=macOS"
`,
    level: 'all',
} as const;

export const TEST_TARGET_PBXPROJ = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1,F2,G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F3,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = Value.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = ValueTests.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F3 = { isa = PBXFileReference; path = Inspection.xctest; explicitFileType = "wrapper.cfbundle"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; }; B2 = { isa = PBXBuildFile; fileRef = F2; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,B2,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Inspection; productName = Inspection; productReference = F3; productType = "com.apple.product-type.bundle.unit-test"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Inspection; PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage"; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO; }; };
 };
}
`;

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

export const BLOCK_COMMENT_FINDINGS = [
    [1, 1, 'blockComments'],
    [9, 1, 'blockComments'],
] as const;

export const SPACED_COMMENT_FINDINGS = [
    [9, 1, 'docComments'],
    [9, 1, 'spaceInsideComments'],
] as const;

export const IMPORTED_SOURCE_REASON = 'The imported source retains its documentation layout.';

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
