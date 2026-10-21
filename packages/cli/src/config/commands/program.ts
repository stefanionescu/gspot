export const UNKNOWN_COMMAND_NAME = /unknown command '([^']+)'/u;

export const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;

/** Commander starts every argument error with this lower-case label. */
export const COMMANDER_ERROR_PREFIX = 'error: ';

export const PROCESS_ARGUMENTS_START = 2;

export const VERSION_PIN_COMMANDS: ReadonlySet<string> = new Set([
    'add',
    'remove',
    'set',
    'unset',
    'ignore',
    'unignore',
    'install',
]);
