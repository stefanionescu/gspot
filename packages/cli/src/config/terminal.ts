export const SCOPE_WIDTH_MIN = 4;

export const ID_WIDTH_MIN = 8;

export const STATUS_WIDTH = 9;

export const FILES_WIDTH = 11;

export const FINDINGS_SHOWN = 200;

export const COMMIT_PREFIX_LENGTH = 7;

export const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
} as const;

export const RESULT_JSON_INDENT = 2;

export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

/** The exit of a command that did not finish: an error, a refusal, an unreadable input, or a cancellation. */
export const EXIT_ERROR = 2;

/** The exit of a command that found something to fix: a finding, a broken tool for doctor. */
export const EXIT_FINDINGS = 1;
