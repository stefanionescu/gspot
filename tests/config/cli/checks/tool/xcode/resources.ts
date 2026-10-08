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
];
