// Git gives the pre-push hook the remote name and the remote URL.
export const PUSH_ARGUMENTS = 2;

export const INTEGER = /^-?\d+$/u;

export const DECIMAL = /^-?\d+\.\d+$/u;

// An opening bracket identifies an intended list or table even without a closing bracket.
export const STRUCTURED = /^[[{]/u;

export const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.version', 'commander.help']);

export const KEY_GAP = 2;

export const VALUE_WIDTH = 28;
