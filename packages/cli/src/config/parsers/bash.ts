/** Shell declarations may put flags between the declaration word and the assignment. */
export const DECLARATION_WORDS = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);

/** These reads consume or examine the whole positional-argument list. */
export const ALL_POSITIONAL_PARAMETERS = new Set(['@', '*', '#']);
