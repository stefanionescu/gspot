/** The folders where Swift Package Manager looks for a target without a path, in its order, by target kind. */
export const SWIFTPM_TARGET_FOLDERS: Readonly<Record<string, readonly string[]>> = {
    target: ['Sources', 'Source', 'src', 'srcs'],
    executableTarget: ['Sources', 'Source', 'src', 'srcs'],
    macro: ['Sources', 'Source', 'src', 'srcs'],
    testTarget: ['Tests', 'Sources', 'Source', 'src', 'srcs'],
    plugin: ['Plugins'],
};

/** Characters that Xcode replaces with an underscore in the module name of a target. */
export const SWIFT_MODULE_NAME_CHARACTERS = /\W/gu;
