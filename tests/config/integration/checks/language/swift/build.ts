export const SWIFT_VALUE_SOURCE = 'public let value: Int = 1\n';

export const SWIFT_VALUE_ERROR = 'public let value: Int = "wrong"\n';

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
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR_SIZE_SOURCE}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
    {
        check: 'swift/periphery',
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

export const XCODE_TOOL_SCHEME =
    '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n';

export const XCODE_BUILD_TABLES = `[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
xcode_destination = "platform=macOS"
`;
