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

export const RECORDING_MODES = new Set(['true', '.all', '.missing', '.failed']);

export const RECORDING_NAMES = new Set(['isRecording', 'SnapshotTesting.isRecording']);
