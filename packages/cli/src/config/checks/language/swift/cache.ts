export const BUILD_LOCK = 'build.lock';

export const SWIFT_BUILD_FOLDER = 'swift';

export const ROOT_BUILD_FOLDER = 'root';

export const SCOPE_FOLDER_PREFIX = 'scope-';

export const BUILD_LOG = 'build.log';

export const PACKAGE_SCRATCH_FOLDER = 'package';

export const SWIFT_PROGRAM = 'swift';

export const SWIFT_BUILD_COMMANDS = {
    compile: { package: ['build', '-v'], xcode: ['build-for-testing'] },
    analyze: { package: ['build', '-v'], xcode: ['clean', 'build-for-testing'] },
    coverage: { package: ['test', '--enable-code-coverage'], xcode: ['test'] },
} as const;

export const XCODE_WORKSPACE_SUFFIX = '.xcworkspace';

export const XCODE_WORKSPACE_FLAG = '-workspace';

export const XCODE_PROJECT_FLAG = '-project';

export const XCODEBUILD_PROGRAM = 'xcodebuild';

export const XCODE_SCHEME_FLAG = '-scheme';

export const XCODE_DESTINATION_FLAG = '-destination';

export const DERIVED_DATA_FLAG = '-derivedDataPath';

export const DERIVED_DATA_FOLDER = 'derived';

export const CODE_SIGNING_OFF = 'CODE_SIGNING_ALLOWED=NO';

export const BUILD_SOURCE_FOLDER = 'source';

export const SCRATCH_PATH_FLAG = '--scratch-path';

export const NO_SWIFT_PROJECT_NOTE = 'Set swift.xcode_project or add Package.swift in this scope.';

export const XCODE_SCHEME_MESSAGE = 'Set swift.xcode_scheme for the configured Xcode project.';
