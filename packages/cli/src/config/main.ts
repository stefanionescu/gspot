export const PIN_COMMANDS: ReadonlySet<string> = new Set([
    'add',
    'check',
    'ignore',
    'install',
    'remove',
    'set',
    'unignore',
    'unset',
]);

export const REMOVED_COMMANDS = {
    apply: 'gspot install writes the generated files. Run gspot install.',
    baseline:
        'gspot baseline was removed. Fix old findings, or run gspot ignore <check> --rule <rule> --paths <old files> --reason "<why>". Delete gspot.baseline.json, and any [[ignore]] of gspot/baseline.',
} as const;

export const REMOVED_OPTIONS: Readonly<Record<string, string>> = {
    '--stage':
        'gspot check --stage was removed. Run gspot check --only <commit|push>. If you did not type this, your hook script is out of date: run gspot install.',
    '--changed': 'gspot check --changed was removed. Run gspot check --base origin/main, or --base origin/HEAD.',
    '--markdown': 'gspot scan --markdown was removed. Run gspot scan, and put its report in a code fence.',
    '--no-configurations':
        'gspot init --no-configurations was removed. Run gspot init --configurations <one name>, then gspot remove <each name> --reason "<why>".',
};

export const UNKNOWN_OPTION_NAME = /unknown option '([^']+)'/u;

export const PROCESS_ARGUMENTS_START = 2;

export const UNKNOWN_COMMAND_NAME = /unknown command '([^']+)'/u;

export const COMMANDER_ERROR_PREFIX = 'error: ';

export const COMMANDS_HELP_MESSAGE = 'Run gspot --help to see the commands.';

export const HELP_WIDTH = 80;

export const HELP_MIN_WRAP_WIDTH = 20;

export const GLOBAL_OPTIONS = {
    '--verbose': 'Print more detail, such as the stack of an internal error',
    '--json': 'Print the report as JSON',
    '--version': 'Print the version',
    '-h, --help': 'Print help',
} as const;

export const PROGRAM_EXIT_CODES = [
    ['0', 'The command finished. For check: no findings remain.'],
    ['1', 'check found findings, init or install left a tool missing, or doctor found a setup problem.'],
    ['2', 'The command could not finish, or an argument is not valid.'],
    ['129, 130, 143', 'check, init, install, or scan stopped because of SIGHUP, Ctrl-C, or SIGTERM.'],
] as const;

export const PROGRAM_HELP_FOOTER =
    'Example:\n  gspot init\n\nRun gspot <command> --help to see the options of one command.\n';

export const USAGE_LINE = 'Usage: gspot <command> [options]';

export const HELP_FLAG = '-h, --help';

export const VERSION_FLAG = '--version';

export const INVALID_VALUE =
    /^error: (?:option '(?<option>--[a-z-]+)(?: [^']*)?' argument|command-argument value) '(?<value>.*)' is invalid(?: for argument '[^']+')?\. (?<detail>.*)$/su;

export const ALLOWED_CHOICES = /^Allowed choices are (.+)\.$/u;

export const UNKNOWN_COMMAND_ERROR_CODE = 'commander.unknownCommand';

export const UNKNOWN_OPTION_ERROR_CODE = 'commander.unknownOption';

export const JSON_FLAG = '--json';

export const VERBOSE_FLAG = '--verbose';

export const HELP_ERROR_CODE = 'commander.help';

export const FATAL_ERROR_EVENTS = ['uncaughtException', 'unhandledRejection'] as const;
