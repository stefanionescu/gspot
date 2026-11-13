import { GROUPED_PBXPROJ } from '#tests/config/setup/configurations.ts';

// swift build
export const FAILED_BUILD_FINDINGS = [
    {
        file: 'Main.swift',
        line: 4,
        column: 2,
        rule: 'compiler',
        message: 'Missing value',
    },
] as const;
export const PRIVATE_MAIN_FINDING = {
    file: '/var/folders/project/Main.swift',
    line: 4,
    column: 2,
    rule: 'compiler',
    message: 'Missing value',
} as const;
export const PRIVATE_OTHER_FINDING = {
    file: '/var/folders/project/Other.swift',
    line: 5,
    column: 3,
    rule: 'compiler',
    message: 'Unknown name',
} as const;

// swift project cache
export const SWIFT_PROJECT_SELECTION_CASES = [
    {
        name: 'keeps an inherited authored project origin',
        scope: 'app',
        tables: `[[scope]]
path = "app"

[swift]
xcode_project = "Root.xcodeproj"
xcode_scheme = "App"

`,
        files: { 'Root.xcodeproj/project.pbxproj': '', 'app/Child.xcodeproj/project.pbxproj': '' },
        project: 'Root.xcodeproj',
        argument: '../Root.xcodeproj',
    },
    {
        name: 'keeps a scoped authored workspace',
        scope: 'app',
        tables: `[[scope]]
path = "app"
swift = { xcode_project = "Choice.xcworkspace", xcode_scheme = "App" }
`,
        files: { 'app/Child.xcodeproj/project.pbxproj': '', 'app/Choice.xcworkspace/contents.xcworkspacedata': '' },
        project: 'app/Choice.xcworkspace',
        argument: 'Choice.xcworkspace',
    },
] as const;

// swift skip reasons
export const SKIP_REASON_CASES = [
    { body: 'let trait = .enabled(if: false)', missing: true },
    { body: 'let trait = Testing.ConditionTrait.enabled(if: false, "Requires a simulator")', missing: false },

    { body: 'try XCTSkip()', missing: true },
    { body: 'try XCTSkip("   ")', missing: true },
    { body: 'try XCTSkip(nil)', missing: true },
    { body: 'try XCTSkip("CI")', missing: false },
    { body: String.raw`try XCTSkip("\n")`, missing: true },
    { body: 'print("unrelated long string"); try XCTSkipIf(true, "")', missing: true },
    { body: 'try XCTSkipIf(condition("unrelated long string"))', missing: true },
    { body: 'try XCTSkipUnless(true, "Requires a simulator")', missing: false },
    { body: 'try XCTSkipUnless(true)', missing: true },
    { body: 'service.disabled(if: true)', missing: false },
    { body: 'let trait = .disabled(if: true, "")', missing: true },
    { body: 'let trait = .disabled(if: true, "Requires a simulator")', missing: false },
    { body: '@available(*, unavailable, message: "")\nfunc unavailableTest() {}', missing: true },
    {
        body: '@available(*, unavailable, message: "Requires a simulator")\nfunc unavailableTest() {}',
        missing: false,
    },
    { body: '// Requires a simulator.\n@available(*, unavailable)\nfunc unavailableTest() {}', missing: false },
    { body: 'let example = "XCTSkip()"\n/* XCTSkip() */\n// XCTSkip()', missing: false },
] as const;

// swift tests
const SWIFT_TARGET_COVERAGE_OUTPUT = {
    targets: [
        { name: 'App', lineCoverage: 0.6 },
        { name: 'Library', lineCoverage: 0.75 },
    ],
} as const;
export const COVERAGE_LIMIT_CASES = [
    {
        name: 'a named target passes its limit',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nmin_line_percent = 0\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = 61\nreason = "Required target coverage."\n',
        expected: [],
    },
    {
        name: 'a named target misses its limit',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nmin_line_percent = 0\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = 62\nreason = "Required target coverage."\n',
        expected: [/\bApp\b.+\b61%.+\b62%/u],
    },
    {
        name: 'a named target is absent',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nmin_line_percent = 0\n[[coverage.swift_target]]\nname = "Widget"\nmin_line_percent = 10\nreason = "Required target coverage."\n',
        expected: [/\bWidget\b/u],
    },
    {
        name: 'a target misses the shared limit',
        report: SWIFT_TARGET_COVERAGE_OUTPUT,
        tables: '[coverage]\nmin_line_percent = 70\nswift_target = []\n',
        expected: [/\bApp\b.+\b60%.+\b70%/u],
    },
    {
        name: 'a named target overrides the shared limit',
        report: SWIFT_TARGET_COVERAGE_OUTPUT,
        tables: '[coverage]\nmin_line_percent = 70\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = 60\nreason = "Required target coverage."\n',
        expected: [],
    },
] as const;
export const SWIFT_PACKAGE_COVERAGE_FILES = [
    { filename: 'Custom/Core/First.swift', summary: { lines: { count: 3, covered: 1 } } },
    { filename: 'Custom/Core/Second.swift', summary: { lines: { count: 1, covered: 1 } } },
    { filename: 'Sources/API/API.swift', summary: { lines: { count: 3, covered: 2 } } },
    { filename: 'Tests/CoreTests/CoreTests.swift', summary: { lines: { count: 2, covered: 2 } } },
] as const;
export const SWIFT_PACKAGE_COVERAGE_TARGETS = [
    {
        name: 'Core',
        path: 'Custom/Core',
        type: 'library',
        module_type: 'SwiftTarget',
        sources: ['First.swift', 'Second.swift'],
    },
    { name: 'API', path: 'Sources/API', type: 'library', module_type: 'SwiftTarget', sources: ['API.swift'] },
    {
        name: 'CoreTests',
        path: 'Tests/CoreTests',
        type: 'test',
        module_type: 'SwiftTarget',
        sources: ['CoreTests.swift'],
    },
    { name: 'Native', path: 'Sources/Native', type: 'library', module_type: 'ClangTarget', sources: ['native.c'] },
] as const;
const EXAMPLE_TARGET_LIMIT = '[[coverage.swift_target]]\nname = "Example"\nmin_line_percent = 80\n';
export const XCTEST_TABLES = `${EXAMPLE_TARGET_LIMIT}[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n`;

// swiftlint analyze
export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, stage: 'build' },
    { buildCode: 0, analyzerCode: 7, stage: 'swiftlint' },
] as const;

// xcode
export const ASSET_SETTING_CASES = [
    {
        title: 'An Info.plist image name',
        path: 'Info.plist',
        text: '<plist><dict><key>UIImageName</key><string>AccentColor</string></dict></plist>\n',
    },
    {
        title: 'A root Xcode project setting',
        path: 'App.xcodeproj/project.pbxproj',
        text: '{ objects = { CONFIG = { isa = XCBuildConfiguration; buildSettings = { ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; }; }; }; }\n',
    },
    {
        title: 'A root xcconfig setting',
        path: 'Build.xcconfig',
        text: 'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor\n',
    },
] as const;
export const ENTITLEMENT_SCOPE_RESULTS = [
    { scope: '', status: 'passed' },
    { scope: 'app', status: 'passed' },
    { scope: 'app/child', status: 'failed' },
    { scope: 'sibling', status: 'passed' },
] as const;
export const INVALID_RESOURCE_DOCUMENTS = [
    { check: 'xcode/xcstrings', path: 'Localizable.xcstrings', text: 'null' },
    { check: 'xcode/assets', path: 'App/Assets.xcassets/Logo.imageset/Contents.json', text: '{' },
] as const;
const LOGO_CONTENTS = 'App/Assets.xcassets/Logo.imageset/Contents.json';
const LOGO_IMAGE = 'App/Assets.xcassets/Logo.imageset/logo.png';
export const LOGO_IMAGE_SET = {
    contents: LOGO_CONTENTS,
    image: LOGO_IMAGE,
    missingFinding: {
        file: LOGO_CONTENTS,
        line: 1,
        rule: 'missing-image',
    },
    files: {
        [LOGO_CONTENTS]: '{"images":[{"filename":"logo.png"}]}\n',
        [LOGO_IMAGE]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    },
} as const;
export const PARTLY_TRANSLATED_STRINGS = {
    sourceLanguage: 'en',
    version: '1.0',
    strings: {
        Hello: { localizations: { fr: { stringUnit: { state: 'translated', value: 'Bonjour' } } } },
        Goodbye: {},
    },
};
export const SINGLE_FILE_PBXPROJ = GROUPED_PBXPROJ.replace('files = (B1, B2,);', 'files = (B2,);').replace(
    'fileSystemSynchronizedGroups = (SYNC,);',
    '',
);
