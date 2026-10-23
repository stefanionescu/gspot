export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u2019][\p{L}\p{M}\p{N}_]+)*$/u;

export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

export const REEXPORT_MODES = ['none', 'index-only'] as const;
