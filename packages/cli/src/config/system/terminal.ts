export const RESULT_JSON_INDENT = 2;

export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

export const TERMINAL_CONTROL_CHARACTERS = /[^\P{Cc}\t\n]|\p{Cf}/gu;

export const TERMINAL_COLOR_SEQUENCE = new RegExp(
    String.raw`(${String.fromCodePoint(0x1b)}\[(?:2|22|3[1236]|39)m)`,
    'u',
);
