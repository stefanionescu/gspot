export const XCODE_WORKSPACE_SUFFIX = '.xcworkspace';

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

/** Selected source copies shared by the compiler, analyzer, Periphery, and coverage. */
export const BUILD_SOURCE_DIRECTORY = 'source';

/** Package commands for each Swift build task. */
export const PACKAGE_COMMANDS = {
    compile: ['build', '-v'],
    analyze: ['build', '-v'],
    coverage: ['test', '--enable-code-coverage'],
} as const;

/** Native Xcode operations for each independent Swift consumer. */
export const XCODE_COMMANDS = {
    compile: ['build-for-testing'],
    analyze: ['clean', 'build-for-testing'],
    coverage: ['test'],
} as const;

export const SWIFTLINT_CONFIG_FILE = '.swiftlint.yml';

export const MACOS_PRIVATE_REPLACEMENT = '$<before>/$<folder>/';

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

export const SWIFTLINT_YML = 'swiftlint.yml';

export const SWIFTLINT_ANALYZE_COMMAND = ['swiftlint', 'analyze', '--strict', '--quiet'] as const;

export const SWIFTLINT_CONFIG_FLAG = '--config';

export const COMPILER_LOG_FLAG = '--compiler-log-path';

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

export const PERIPHERY_YML = 'periphery.yml';

export const PERIPHERY_COMMAND = [
    'periphery',
    'scan',
    '--strict',
    '--quiet',
    '--format',
    'xcode',
    '--disable-update-check',
    '--config',
] as const;

export const SCRATCH_PATH_FLAG = '--scratch-path';

export const SWIFT_PROGRAM = 'swift';

export const SWIFT_BUILD_FOLDER = 'swift';

export const ROOT_BUILD_FOLDER = 'root';

export const SCOPE_FOLDER_PREFIX = 'scope-';

export const BUILD_LOG = 'build.log';

export const PACKAGE_SCRATCH_FOLDER = 'package';

export const XCODEBUILD_PROGRAM = 'xcodebuild';

export const XCODE_WORKSPACE_FLAG = '-workspace';

export const XCODE_PROJECT_FLAG = '-project';

export const XCODE_SCHEME_FLAG = '-scheme';

export const XCODE_DESTINATION_FLAG = '-destination';

export const DERIVED_DATA_FLAG = '-derivedDataPath';

export const DERIVED_DATA_FOLDER = 'derived';

export const CODE_SIGNING_OFF = 'CODE_SIGNING_ALLOWED=NO';

export const BUILD_LOCK = 'build.lock';
