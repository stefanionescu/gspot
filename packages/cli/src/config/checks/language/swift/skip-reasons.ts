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
