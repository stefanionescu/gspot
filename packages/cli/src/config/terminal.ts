export const RESULT_JSON_INDENT = 2;

export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

/** The exit of a command that did not finish: an error, a refusal, an unreadable input, or a cancellation. */
export const EXIT_ERROR = 2;

/** The exit of a command that found something to fix: a finding, a broken tool for doctor. */
export const EXIT_FINDINGS = 1;

export const ROOT_SCOPE_LABEL = 'root';

export const DRY_RUN_NOTE = 'Dry run: nothing was written.';
