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
    'Example:\n  gspot init\n\nRun gspot <command> --help to see the options of one command.\n';

export const CODE_MARK = '`';

export const GIT_COMMANDS: ReadonlySet<string> = new Set([
    'init',
    'install',
    'apply',
    'check',
    'set',
    'unset',
    'add',
    'remove',
    'ignore',
    'unignore',
]);

export const USAGE_LINE = 'Usage: gspot <command> [options]';

export const HELP_FLAG = '-h, --help';

export const JSON_FLAG = '--json';

export const NEEDS_GIT_MESSAGE = 'gspot needs a Git repository. Run git init, then gspot init.';

export const HELP_ERROR_CODE = 'commander.help';
