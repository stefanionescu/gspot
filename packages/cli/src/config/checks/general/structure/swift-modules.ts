export const SWIFTPM_TARGET_FOLDERS: Readonly<Record<string, readonly string[]>> = {
    target: ['Sources', 'Source', 'src', 'srcs'],
    executableTarget: ['Sources', 'Source', 'src', 'srcs'],
    macro: ['Sources', 'Source', 'src', 'srcs'],
    testTarget: ['Tests', 'Sources', 'Source', 'src', 'srcs'],
    plugin: ['Plugins'],
};

export const SWIFT_MODULE_NAME_CHARACTERS = /\W/gu;
