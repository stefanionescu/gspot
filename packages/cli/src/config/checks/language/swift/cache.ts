export const BUILD_LOCK = 'build.lock';

export const DIGEST_ALGORITHM = 'sha256';

export const SWIFT_BUILD_FOLDER = 'swift';

export const ROOT_BUILD_FOLDER = 'root';

export const SCOPE_FOLDER_PREFIX = 'scope-';

export const BUILD_LOG = 'build.log';

export const PACKAGE_SCRATCH_FOLDER = 'package';

export const SWIFT_PROGRAM = 'swift';

/** The SwiftPM arguments and the xcodebuild actions of each Swift build task. */
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

/** The folder of source copies that the compiler, analyzer, Periphery, and coverage share. */
export const BUILD_SOURCE_FOLDER = 'source';

export const SCRATCH_PATH_FLAG = '--scratch-path';
