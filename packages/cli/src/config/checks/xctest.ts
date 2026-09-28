// The literal values checks/xctest reads: names, patterns, limits, and tables.

export const SWIFT_COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;
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
export const PERCENT = 100;
