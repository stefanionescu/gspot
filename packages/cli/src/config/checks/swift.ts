export const XCODE_WORKSPACE_SUFFIX = '.xcworkspace';

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

/** The folder of source copies that the compiler, analyzer, Periphery, and coverage share. */
export const BUILD_SOURCE_FOLDER = 'source';

/** Package commands for each Swift build task. */
export const PACKAGE_COMMANDS = {
    compile: ['build', '-v'],
    analyze: ['build', '-v'],
    coverage: ['test', '--enable-code-coverage'],
} as const;

/** The xcodebuild actions for each build purpose. */
export const XCODE_COMMANDS = {
    compile: ['build-for-testing'],
    analyze: ['clean', 'build-for-testing'],
    coverage: ['test'],
} as const;

export const SWIFTLINT_CONFIG_FILE = '.swiftlint.yml';

export const MACOS_PRIVATE_REPLACEMENT = '$<before>/$<folder>/';

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

/** The name of the config file that the Swift build checks pass to SwiftLint. */
export const SWIFTLINT_CONFIG_NAME = 'swiftlint';

export const SWIFTLINT_ANALYZE_COMMAND = ['swiftlint', 'analyze', '--strict', '--quiet'] as const;

export const SWIFTLINT_CONFIG_FLAG = '--config';

export const COMPILER_LOG_FLAG = '--compiler-log-path';

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

/** The config file name that the Swift build checks pass to Periphery. */
export const PERIPHERY_CONFIG_FILE = 'periphery';

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

export const COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;

/** The positional reason argument for XCTest and Swift Testing skip calls. */
export const SKIP_REASON_ARGUMENT = new Map([
    ['XCTSkip', 0],
    ['XCTSkipIf', 1],
    ['XCTSkipUnless', 1],
    ['.disabled', 0],
    ['ConditionTrait.disabled', 0],
    ['Testing.ConditionTrait.disabled', 0],
]);

export const SWIFT_DESCRIBE_COMMAND = ['swift', 'package', 'describe', '--type', 'json'] as const;

export const COVERAGE_BUNDLE = 'coverage.xcresult';

export const SWIFT_STRING_LITERAL = /^(#*)("""|")([\s\S]*)\2\1$/u;

export const XCTEST_PREFIX = /^XCTest\./u;

export const SWIFT_CODECOV_COMMAND = ['swift', 'test', '--show-codecov-path'] as const;

export const XCODE_COVERAGE_FLAGS = ['-enableCodeCoverage', 'YES', '-resultBundlePath'] as const;

export const XCCOV_COMMAND = ['xcrun', 'xccov', 'view', '--report', '--json'] as const;

export const APP_TARGET_SUFFIX = '.app';

export const SWIFT_TARGET_MODULE = 'SwiftTarget';

export const TEST_TARGET_TYPE = 'test';
