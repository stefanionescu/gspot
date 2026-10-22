export const COMMIT_PREFIX_LENGTH = 7;

export const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);

export const FINDINGS_SHOWN = 200;

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
} as const;

export const FIXER_ERROR_MESSAGE = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;
