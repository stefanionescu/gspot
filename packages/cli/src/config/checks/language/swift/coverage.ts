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
