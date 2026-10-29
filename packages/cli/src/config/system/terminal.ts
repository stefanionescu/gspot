export const RESULT_JSON_INDENT = 2;

export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

export const TERMINAL_CONTROL_CHARACTERS = /[^\P{Cc}\t\n]/gu;
