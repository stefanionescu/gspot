const FINDINGS_SHOWN = 200;

const COMMIT_PREFIX_LENGTH = 7;

const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);

const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
} as const;

const RESULT_JSON_INDENT = 2;

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

/** The exit of a command that did not finish: an error, a refusal, an unreadable input, or a cancellation. */
const EXIT_ERROR = 2;

/** The exit of a command that found something to fix: a finding, a broken tool for doctor. */
const EXIT_FINDINGS = 1;

const ROOT_SCOPE_LABEL = 'root';

const PROGRESS_CLEAR = '\r\u001B[2K';
const FIXER_ERROR_MESSAGE = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

const UNKNOWN_COMMAND_NAME = /unknown command '([^']+)'/u;
const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;

export {
    EXIT_ERROR,
    NOTE_STATUSES,
    EXIT_FINDINGS,
    FINDINGS_SHOWN,
    PROGRESS_CLEAR,
    ROOT_SCOPE_LABEL,
    SIGNAL_EXIT_CODES,
    RESULT_JSON_INDENT,
    COMMAND_SUGGESTION,
    CHECK_STATUS_COLORS,
    FIXER_ERROR_MESSAGE,
    COMMIT_PREFIX_LENGTH,
    UNKNOWN_COMMAND_NAME,
};
