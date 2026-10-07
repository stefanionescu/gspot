import type { CheckStatus } from '#cli/types/execution/check.ts';

export const SCOPE_WIDTH_MIN = 4;

export const ID_WIDTH_MIN = 8;

export const STATUS_WIDTH = 9;

export const FILES_WIDTH = 11;

export const FINDINGS_SHOWN = 200;

export const COMMIT_PREFIX_LENGTH = 7;

export const NOTE_STATUSES = new Set<CheckStatus>(['missing', 'error', 'skipped']);

export const CHECK_STATUS_COLORS: Record<CheckStatus, 'green' | 'red' | 'yellow'> = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
};

export const RESULT_JSON_INDENT = 2;
