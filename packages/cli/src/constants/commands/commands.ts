// The literal values commands reads: names, patterns, limits, and tables.

export const SET_NEAR_LIMIT = 12;
export const RULE_KEY_DEPTH = 3;
export const INTEGER = /^-?\d+$/u;
export const DECIMAL = /^-?\d+\.\d+$/u;
// A value that opens with a bracket is meant as a list or a table, whether or not it closes.
export const STRUCTURED = /^[[{]/u;
export const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.version', 'commander.help']);
export const KNOWN_ERRORS = new Set([
    'PolicyError',
    'SelectionError',
    'ManifestError',
    'VersionPinError',
    'NoTerminalError',
    'PromptError',
    'ProfileError',
]);
export const KEY_GAP = 2;
export const VALUE_WIDTH = 28;
