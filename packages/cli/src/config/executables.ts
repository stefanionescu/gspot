import { MISE_LOCKFILE, MISE_CONFIG_FILE } from '#cli/config/files/names.ts';

export const MISE_INSTALL_URL = 'https://mise.jdx.dev/getting-started.html';

export const AVAILABLE_TOOL_STATES: ReadonlySet<string> = new Set(['ok', 'system', 'newer']);

export const DOCKER_TOOL = 'docker';

export const INSTALL_HELP = 'Run gspot install.';

export const MISE_LAUNCHER_FOLDER = 'shims';

export const MISE_WHICH = 'which';

export const MISE_TOOL = 'mise';

export const MISE_BIN_PATHS_ARGUMENTS = [MISE_TOOL, 'bin-paths'] as const;

export const NPM_BIN_FOLDER = 'node_modules/.bin';

export const MISE_TRUSTED_PATHS_VARIABLE = 'MISE_TRUSTED_CONFIG_PATHS';

export const MISE_CEILING_PATHS_VARIABLE = 'MISE_CEILING_PATHS';

export const MISE_CONFIG_NAME = /^(?:\.?mise|\.rtx|\.tool-versions$|\.config$)/u;

export const MISE_PROJECT_FILES = new Set([MISE_CONFIG_FILE, MISE_LOCKFILE]);

export const TOOL_ENVIRONMENT = { NO_COLOR: '1', FORCE_COLOR: '0' } as const;

export const INTERPRETER_FLAGS: Readonly<Record<string, string>> = { basedpyright: '--pythonpath' };

export const PYTHON_EXECUTABLE = 'python';

export const UV_TOOL = 'uv';

export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;

export const UV_FLAGS = {
    project: '--project',
    with: '--with',
    directory: '--directory',
    configFile: '--config-file',
} as const;

export const UV_PROJECT_ENVIRONMENT = 'UV_PROJECT_ENVIRONMENT';

export const PYTHON_ENVIRONMENT_CHECKS: ReadonlySet<string> = new Set(['python/basedpyright', 'pytest/coverage']);

export const PROJECT_ENVIRONMENT_MESSAGE = 'The project environment .venv is missing. Run uv sync, then check again.';

export const NO_VERSION = 'No version is set for shim';

export const VERSION_FLAG = '--version';
