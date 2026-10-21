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

export const PROGRESS_CLEAR = '\r\u001B[2K';

export const FIXER_ERROR_MESSAGE = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

export const CHECK_LIST_SEPARATOR = ',';
