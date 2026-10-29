export const NO_CHECK_IGNORE_TEXTS = {
    unmatched: 'no ignore without a check matches',
    removed: 'without a check',
} as const;

export const ESCAPED_GLOB_CHARACTERS = /\\([()[\]{}*?!+@])/gu;
