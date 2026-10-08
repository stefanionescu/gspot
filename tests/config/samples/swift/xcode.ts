export const XCODE_PROJECT = `// !$*UTF8*$!
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
