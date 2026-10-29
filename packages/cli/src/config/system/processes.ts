export const EXIT_CLEANUP_MILLISECONDS = 10;

export const OUTPUT_CLOSE_MILLISECONDS = 5000;

export const TASKKILL_GONE_CODE = 128;

export const FAILED_CODE = 1;

export const MISSING_CODE = 127;

export const PATHEXT_DEFAULT = '.COM;.EXE;.BAT;.CMD';

export const PATH_SEPARATORS = /[\\/]/u;

export const TASKKILL_PROGRAM = 'taskkill';

export const TASKKILL_FLAGS = ['/T', '/F'] as const;

export const TASKKILL_PID_FLAG = '/pid';

export const PROCESS_CLEANUP_MESSAGE = 'Tool execution and process cleanup failed.';

export const EMPTY_COMMAND_MESSAGE = 'An empty command cannot run.';

export const OUTPUT_LIMIT = 256 * 1024 * 1024;
