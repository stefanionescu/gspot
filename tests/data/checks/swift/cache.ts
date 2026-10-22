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
swift = { xcode_project = "app/Choice.xcworkspace", xcode_scheme = "App" }
`,
        files: { 'app/Child.xcodeproj/project.pbxproj': '', 'app/Choice.xcworkspace/contents.xcworkspacedata': '' },
        project: 'app/Choice.xcworkspace',
        argument: 'Choice.xcworkspace',
    },
] as const;

export const SWIFT_BUILD_PURPOSES = [
    { purpose: 'compile', check: 'swift/build' },
    { purpose: 'analyze', check: 'swift/swiftlint-analyze' },
    { purpose: 'coverage', check: 'swift/coverage' },
] as const;
