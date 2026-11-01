export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

export const COMPILER_RULE = 'compiler';

export const SWIFT_BUILD_NAME = 'Swift build';

export const SWIFTC_CALL = 'swiftc ';

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

export const SWIFT_CODECOV_COMMAND = ['swift', 'test', '--show-codecov-path'] as const;

export const SWIFT_DESCRIBE_COMMAND = ['swift', 'package', 'describe', '--type', 'json'] as const;

export const COVERAGE_BUNDLE = 'coverage.xcresult';

export const XCODE_COVERAGE_FLAGS = ['-enableCodeCoverage', 'YES', '-resultBundlePath'] as const;

export const XCCOV_COMMAND = ['xcrun', 'xccov', 'view', '--report', '--json'] as const;

export const APP_TARGET_SUFFIX = '.app';

export const TEST_TARGET_TYPE = 'test';

export const SWIFT_TARGET_MODULE = 'SwiftTarget';

export const SWIFT_TEST_NAME = 'swift test';

export const SWIFT_PACKAGE_NAME = 'swift package';

export const COVERAGE_RULE = 'coverage';

export const SWIFT_TESTS_MESSAGE = 'Swift tests failed';

export const SWIFT_CODECOV_MESSAGE = 'Swift did not report its coverage path';

export const SWIFT_DESCRIBE_MESSAGE = 'Swift could not describe its package targets';

export const MISSING_COVERAGE_MESSAGE = 'Swift produced no UTF-8 coverage report at its reported path.';

export const TEST_RUNNER_MESSAGE = 'The test runner printed no error output.';

export const COVERAGE_VIEWER_MESSAGE = 'The coverage viewer printed no error output.';

export const XCTEST_FAILURE_LINE = /^(?<file>.+?):(?<line>\d+): error: -\[.+?\] : (?<message>.+)$/u;
export const SWIFT_TESTING_FAILURE_LINE =
    /Test .+? recorded an issue at (?<file>.+?):(?<line>\d+):(?<column>\d+): (?<message>.+)$/u;
export const FAILED_TEST_RULE = 'failed-test';

export const DOCUMENTED_DECLARATIONS = ['function_declaration', 'init_declaration'] as const;

export const PUBLIC_VISIBILITIES: ReadonlySet<string> = new Set(['public', 'open']);

export const OVERRIDE_MODIFIER = 'override';

export const COMMENT_NODES: ReadonlySet<string> = new Set(['comment', 'multiline_comment']);

export const DOC_COMMENT_START = /^\/\/\/|^\/\*\*/u;

export const DOCUMENTED_PARAMETER = /^[\t */]*-[\t ]+(?:Parameter[\t ]+)?(?<name>\w+)[\t ]*:/gmu;

export const INITIALIZER_NAME = 'init';

export const UNNAMED_PARAMETER = '_';

export const MISSING_PARAMETER_RULE = 'missing-parameter';

export const PERIPHERY_TOOL = 'periphery';

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

export const UNUSED_RULE = 'unused';

export const SWIFT_STRING_LITERAL = /^(#*)("""|")([\s\S]*)\2\1$/u;

export const XCTEST_PREFIX = /^XCTest\./u;

export const SKIP_REASON_ARGUMENT = new Map([
    ['XCTSkip', 0],
    ['XCTSkipIf', 1],
    ['XCTSkipUnless', 1],
    ['.enabled', 0],
    ['ConditionTrait.enabled', 0],
    ['Testing.ConditionTrait.enabled', 0],
    ['.disabled', 0],
    ['ConditionTrait.disabled', 0],
    ['Testing.ConditionTrait.disabled', 0],
]);

export const COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;

export const REASON_GROUP_INDEX = 3;

export const DISABLED_TEST_RULE = 'disabled';

export const DISABLED_TEST_MESSAGE =
    'Explain why this test is disabled in its reason argument or availability annotation.';

export const SWIFTLINT_TOOL = 'swiftlint';

export const SWIFTLINT_ANALYZE_COMMAND = ['swiftlint', 'analyze', '--strict', '--quiet'] as const;

export const SWIFTLINT_CONFIG_FLAG = '--config';

export const COMPILER_LOG_FLAG = '--compiler-log-path';

export const SWIFTLINT_CONFIG_FILE = '.swiftlint.yml';

export const ANALYZER_RULE = 'analyzer';
