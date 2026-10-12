export const COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;

export const SLEEP_CALLS = new Set([
    'sleep',
    'usleep',
    'Darwin.sleep',
    'Darwin.usleep',
    'Glibc.sleep',
    'Glibc.usleep',
    'Thread.sleep',
    'Task.sleep',
]);

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

export const TYPED_TASK_CALL = /^Task<[^>]+>\./u;

export const SWIFT_CODECOV_COMMAND = ['swift', 'test', '--show-codecov-path'] as const;

export const XCODE_COVERAGE_FLAGS = ['-enableCodeCoverage', 'YES', '-resultBundlePath'] as const;

export const XCCOV_COMMAND = ['xcrun', 'xccov', 'view', '--report', '--json'] as const;

export const APP_TARGET_SUFFIX = '.app';

export const SWIFT_TARGET_MODULE = 'SwiftTarget';

export const TEST_TARGET_TYPE = 'test';
