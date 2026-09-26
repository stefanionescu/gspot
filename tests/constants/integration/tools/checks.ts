// The literal values integration/tools/checks reads: names, patterns, limits, and tables.

export const XCTEST_COVERAGE_SOURCE =
    'func first() -> Int {\n    return 1\n}\nfunc second() -> Int {\n    return 2\n}\n';
export const SECRETS_FILES_POLICY = 'version = 1\nconfigurations = ["secrets"]\n[rules]\ninstall = false\n';
export const XCTEST_COVERAGE_TESTS =
    'import XCTest\nfinal class ValueTests: XCTestCase {\n    func testValues() {\n        XCTAssertEqual(first(), 1)\n    }\n}\n';
export const XCTEST_COVERAGE_PROJECT = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1,F2,G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F3,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = Value.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = ValueTests.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F3 = { isa = PBXFileReference; path = Probe.xctest; explicitFileType = "wrapper.cfbundle"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; }; B2 = { isa = PBXBuildFile; fileRef = F2; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,B2,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Probe; productName = Probe; productReference = F3; productType = "com.apple.product-type.bundle.unit-test"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Probe; PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage"; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO; }; };
 };
}
`;
// This compatibility fixture uses the installed CLI release and its database image selection.
export const CLI_VERSION = '2.72.7';
/** A planted token with the shape gitleaks looks for; it belongs to nothing. */
// eslint-disable-next-line sonarjs/no-hardcoded-secrets -- the planted token is the defect the secrets check must find
export const PLANTED_TOKEN = 'const token = "ghp_Xk92lM3nPq7RsT1vWy4ZaB6cDe8FgH0iJkLmN";\n';
