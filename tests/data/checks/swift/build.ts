import { PAIR_SIZE_SOURCE } from '#tests/data/checks/swift/sandbox.ts';

export const SWIFT_LANGUAGE_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example")])
`;
export const SWIFT_VALUE_SOURCE = 'public let value: Int = 1\n';
export const SWIFT_VALUE_ERROR = 'public let value: Int = "wrong"\n';
export const SWIFT_PACKAGE = `// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;
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
export const SWIFT_PACKAGE_CASES = [
    {
        check: 'swift/swiftlint-analyze',
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR_SIZE_SOURCE}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift': `${PAIR_SIZE_SOURCE}
private func neverCalled() -> Int {
    count(of: 3)
}

private func count(of size: Int) -> Int {
    size
}
`,
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
] as const;

/** The SwiftLint config files of a nested scope. */
export const NESTED_SWIFTLINT_FILES = [
    '.gspot/configurations/language/swift/swiftlint.yml',
    'app/.swiftlint.yml',
    'app/Sources/.swiftlint.yml',
    'app/Sources/Feature/.swiftlint.yml',
] as const;

/** The Other.swift diagnostic without the /private prefix. */
export const PRIVATE_OTHER_FINDING = {
    file: '/var/folders/project/Other.swift',
    line: 5,
    column: 3,
    rule: 'compiler',
    message: 'Unknown name',
} as const;

/** The Main.swift diagnostic without the /private prefix. */
export const PRIVATE_MAIN_FINDING = {
    file: '/var/folders/project/Main.swift',
    line: 4,
    column: 2,
    rule: 'compiler',
    message: 'Missing value',
} as const;

/** The swift/build finding after a failed build. */
export const FAILED_BUILD_FINDINGS = [
    {
        check: 'swift/build',
        file: 'Main.swift',
        line: 4,
        column: 2,
        rule: 'compiler',
        message: 'Missing value',
        fixable: false,
        help: 'Fix the first compiler error; later ones often come from the same mistake.',
    },
] as const;

/** The two analyzer exits, with the exact message of each. */
export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, message: /build exited 7/u },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: /^The swiftlint command failed \(exit 7\): The tool printed no error output\.$/u,
    },
] as const;

/** Compiler stderr that names one source under /private/var/folders and one under /var/folders. */
export const PRIVATE_PREFIX_STDERR =
    '/private/var/folders/project/Main.swift:4:2: error: Missing value\n/var/folders/project/Other.swift:5:3: error: Unknown name';
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
export const XCODE_TOOL_SCHEME =
    '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n';
export const XCODE_BUILD_TABLES = `[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
xcode_destination = "platform=macOS"
`;
