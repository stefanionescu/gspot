export const UNKNOWN_COMMAND_NAME = /unknown command '([^']+)'/u;

export const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;

export const COMMANDER_ERROR_PREFIX = 'error: ';

export const EXIT_CODE_SPACING = 2;

export const HELP_TERM_WIDTH = 29;

export const GLOBAL_OPTIONS = { '--version': 'Print the version', '-h, --help': 'Print help' } as const;

export const PROGRAM_EXIT_CODES = [
    ['0', 'The command finished. For check: no findings remain.'],
    ['1', 'check found findings, or doctor found a setup problem.'],
    ['2', 'The command could not finish, or an argument is not valid.'],
    ['130, 143', 'check or install stopped because of Ctrl-C or SIGTERM.'],
] as const;

export const PROGRAM_HELP_FOOTER =
    'Example:\n  gspot init --dry-run\n\nRun gspot <command> --help to see the options of one command.\n';

export const CODE_MARK = '`';

export const VERSION_PIN_COMMANDS: ReadonlySet<string> = new Set([
    'add',
    'remove',
    'set',
    'unset',
    'ignore',
    'unignore',
    'install',
]);
