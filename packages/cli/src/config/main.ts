import { VERSION_FLAG } from '#cli/config/tools/programs.ts';

// commander errors

export const ALLOWED_CHOICES = /^Allowed choices are (.+)\.$/u;

export const COMMANDER_ERROR_PREFIX = 'error: ';

export const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;

export const DASH_VALUE_COMMANDS: ReadonlySet<string> = new Set(['set', 'unset']);

export const DASH_VALUE_HELP = 'To pass a value that starts with -, put -- before it.';

export const HELP_ERROR_CODE = 'commander.help';

export const INVALID_VALUE =
    /^error: (?:option '(?<option>--[a-z-]+)(?: [^']*)?' argument|command-argument value) '(?<value>.*)' is invalid(?: for argument '[^']+')?\. (?<detail>.*)$/su;

export const UNKNOWN_COMMAND_ERROR_CODE = 'commander.unknownCommand';

export const UNKNOWN_COMMAND_NAME = /unknown command '([^']+)'/u;

export const UNKNOWN_OPTION_ERROR_CODE = 'commander.unknownOption';

// commands

export const NAME_LIST_SEPARATOR = ',';

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

// process start

export const FATAL_ERROR_EVENTS = ['uncaughtException', 'unhandledRejection'] as const;

export const PROCESS_ARGUMENTS_START = 2;

// program help

export const COMMANDS_HELP_MESSAGE = 'Run gspot --help to see the commands.';

export const HELP_FLAG = '-h, --help';

export const JSON_FLAG = '--json';

export const VERBOSE_FLAG = '--verbose';

export const GLOBAL_OPTIONS = {
    [VERBOSE_FLAG]: 'Print more detail, such as the stack of an internal error',
    [JSON_FLAG]: 'Print the report as JSON',
    [VERSION_FLAG]: 'Print the version',
    [HELP_FLAG]: 'Print help',
} as const;

export const HELP_MIN_WRAP_WIDTH = 20;

export const HELP_WIDTH = 80;

export const PROGRAM_EXIT_CODES = [
    ['0', 'The command finished. For check: no findings remain.'],
    ['1', 'check found findings, init or install left a tool missing, or doctor found a setup problem.'],
    ['2', 'The command could not finish, or an argument is not valid.'],
    ['129, 130, 143', 'check, init, install, or scan stopped because of SIGHUP, Ctrl-C, or SIGTERM.'],
] as const;

export const PROGRAM_HELP_FOOTER =
    'Example:\n  gspot init\n\nRun gspot <command> --help to see the options of one command.\n';

export const USAGE_LINE = 'Usage: gspot <command> [options]';
