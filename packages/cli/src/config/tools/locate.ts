import { MISE_LOCKFILE, MISE_CONFIG_FILE } from '#cli/config/files/names.ts';

export const MISE_LAUNCHER_FOLDER = 'shims';

export const MISE_WHICH = 'which';

export const MISE_TOOL = 'mise';

export const MISE_BIN_PATHS_ARGUMENTS = [MISE_TOOL, 'bin-paths'] as const;

export const NPM_BIN_FOLDER = 'node_modules/.bin';

export const MISE_TRUSTED_PATHS_VARIABLE = 'MISE_TRUSTED_CONFIG_PATHS';

export const MISE_CEILING_PATHS_VARIABLE = 'MISE_CEILING_PATHS';

export const MISE_CONFIG_NAME = /^(?:\.?mise|\.rtx|\.tool-versions$|\.config$)/u;

export const MISE_PROJECT_FILES = new Set([MISE_CONFIG_FILE, MISE_LOCKFILE]);
