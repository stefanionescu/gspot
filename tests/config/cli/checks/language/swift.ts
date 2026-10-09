export const SWIFT_PROJECT_SELECTION_CASES = [
    {
        name: 'detects the root project',
        scope: '',
        tables: '',
        files: { 'Root.xcodeproj/project.pbxproj': '' },
        project: 'Root.xcodeproj',
        argument: 'Root.xcodeproj',
    },
    {
        name: 'detects the scoped project without borrowing its parent',
        scope: 'app',
        tables: '[scope."app"]\n',
        files: { 'Root.xcodeproj/project.pbxproj': '', 'app/Child.xcodeproj/project.pbxproj': '' },
        project: 'app/Child.xcodeproj',
        argument: 'Child.xcodeproj',
    },
    {
        name: 'keeps an inherited authored project origin',
        scope: 'app',
        tables: '[swift]\nxcode_project = "Root.xcodeproj"\n[scope."app"]\n',
        files: { 'Root.xcodeproj/project.pbxproj': '', 'app/Child.xcodeproj/project.pbxproj': '' },
        project: 'Root.xcodeproj',
        argument: '../Root.xcodeproj',
    },
    {
        name: 'keeps a scoped authored workspace',
        scope: 'app',
        tables: '[scope."app"]\n[scope."app".swift]\nxcode_project = "Choice.xcworkspace"\n',
        files: { 'app/Child.xcodeproj/project.pbxproj': '', 'app/Choice.xcworkspace/contents.xcworkspacedata': '' },
        project: 'app/Choice.xcworkspace',
        argument: 'Choice.xcworkspace',
    },
] as const;

export const SWIFT_BUILD_PURPOSES = [
    { purpose: 'compile', check: 'swift/build' },
    { purpose: 'analyze', check: 'swift/swiftlint-analyze' },
    { purpose: 'periphery', check: 'swift/periphery' },
    { purpose: 'coverage', check: 'swift-tests/coverage' },
] as const;
