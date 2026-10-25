export const GROUPED_PBXPROJ = `// !$*UTF8*$!
{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = MAIN; targets = (T,); };
        MAIN = {isa = PBXGroup; children = (FIRST, SECOND, ROOT, SYNC,); sourceTree = "<group>"; };
        FIRST = {isa = PBXGroup; name = "Display name"; path = "First Group"; children = (VIRTUAL,); sourceTree = "<group>"; };
        VIRTUAL = {isa = PBXGroup; name = "Virtual display"; children = (F1,); sourceTree = "<group>"; };
        SECOND = {isa = PBXGroup; path = Second; children = (F2,); sourceTree = "<group>"; };
        ROOT = {isa = PBXFileReference; path = Root.swift; sourceTree = SOURCE_ROOT; };
        F1 /* duplicate name */ = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        F2 = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        B1 = {isa = PBXBuildFile; fileRef = F1; };
        B2 = {isa = PBXBuildFile; fileRef = ROOT; };
        SOURCES = {isa = PBXSourcesBuildPhase; files = (B1, B2,); };
        T = {isa = PBXNativeTarget; buildPhases = (SOURCES,); fileSystemSynchronizedGroups = (SYNC,); };
        SYNC = {isa = PBXFileSystemSynchronizedRootGroup; path = Synced; sourceTree = "<group>"; exceptions = (EXCEPT,); };
        EXCEPT = {isa = PBXFileSystemSynchronizedBuildFileExceptionSet; target = T; membershipExceptions = (Excluded.swift,); };
    };
}
`;

export const BUILD_SETTINGS_PBXPROJ =
    '{rootObject=P;objects={P={isa=PBXProject;};D={isa=XCBuildConfiguration;buildSettings={SDKROOT=macosx;SWIFT_VERSION=6.0;};};};}';

export const ASSET_SETTING_CASES = [
    {
        title: 'A root Xcode project setting',
        scope: '',
        path: 'App.xcodeproj/project.pbxproj',
        text: '{ objects = { CONFIG = { isa = XCBuildConfiguration; buildSettings = { ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; }; }; }; }\n',
    },
    {
        title: 'A root xcconfig setting',
        scope: '',
        path: 'Build.xcconfig',
        text: 'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor\n',
    },
    {
        title: 'A scoped Xcode project setting',
        scope: 'app/',
        path: 'app/App.xcodeproj/project.pbxproj',
        text: '{ objects = { CONFIG = { isa = XCBuildConfiguration; buildSettings = { ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; }; }; }; }\n',
    },
    {
        title: 'A scoped xcconfig setting',
        scope: 'app/',
        path: 'app/Build.xcconfig',
        text: 'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor\n',
    },
] as const;

export const INVALID_RESOURCE_DOCUMENTS = [
    { check: 'xcode/xcstrings', path: 'Localizable.xcstrings', text: 'null' },
    { check: 'xcode/assets', path: 'Assets.xcassets/Logo.imageset/Contents.json', text: '{"images":"invalid"}' },
    { check: 'xcode/xcstrings', path: 'App/Localizable.xcstrings', text: '{' },
    { check: 'xcode/assets', path: 'App/Assets.xcassets/Logo.imageset/Contents.json', text: '{' },
] as const;

export const UNREADABLE_RESOURCES = [
    { check: 'xcode/xcstrings', path: 'App/Localizable.xcstrings', text: '{"sourceLanguage":"en","strings":{}}\n' },
    {
        check: 'xcode/assets',
        path: 'App/Assets.xcassets/Logo.imageset/Contents.json',
        text: '{"images":[{"filename":"logo.png"}]}\n',
    },
] as const;

export const PARTLY_TRANSLATED_STRINGS = {
    sourceLanguage: 'en',
    version: '1.0',
    strings: {
        Hello: { localizations: { fr: { stringUnit: { state: 'translated', value: 'Bonjour' } } } },
        Goodbye: {},
    },
};

export const ENTITLEMENT_SCOPE_RESULTS = [
    { scope: '', status: 'passed' },
    { scope: 'app', status: 'passed' },
    { scope: 'app/child', status: 'failed' },
    { scope: 'sibling', status: 'passed' },
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
        message: 'The image logo.png is not in the set.',
    },
    files: {
        [LOGO_CONTENTS]: '{"images":[{"filename":"logo.png"}]}\n',
        [LOGO_IMAGE]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    },
} as const;

export const SINGLE_FILE_PBXPROJ = GROUPED_PBXPROJ.replace('files = (B1, B2,);', 'files = (B2,);').replace(
    'fileSystemSynchronizedGroups = (SYNC,);',
    '',
);
