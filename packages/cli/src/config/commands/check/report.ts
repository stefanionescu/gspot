export const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);

export const FINDINGS_SHOWN = 200;

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
} as const;

export const FIXER_ERROR_PREFIX = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

export const TOOL_MISSING_MESSAGE = ' (a tool is missing; run gspot install)';

export const STAGED_FILES = 'the staged files';

export const UNCHANGED_FIX_MESSAGE = 'No fixer changed anything.';

export const WORKING_TREE = 'the working tree';

export const RUN_AGAIN = 'run again:';

export const STANDARD_INSTALL_HELP = ' Run gspot install.';
