import { NODE_MODULES } from '#cli/config/system.ts';

// check needs
export const CANCELED_CHECK_NOTE = 'The check was canceled.';
export const DOCKER_DAEMON_NOTE = 'Start Docker, then run the check again.';
export const DOCKER_MISSING_MESSAGE = 'Docker is not installed. Install Docker to run this check.';
export const DOCKER_TOOL = 'docker';

// generated configs
export const CONFIG_FLAG = '--config';
export const CONFIG_TOML_FORMAT = { inlineTableStart: Number.MAX_SAFE_INTEGER, bracketSpacing: false } as const;
export const JSON_INDENT = 4;

// npm bin folder
export const BIN_FOLDER_NAME = '.bin';
export const NPM_BIN_FOLDER = `${NODE_MODULES}/${BIN_FOLDER_NAME}`;

// python environment
export const ACTIVE_ENVIRONMENT_VARIABLE = 'VIRTUAL_ENV';
export const PROJECT_ENVIRONMENT_MESSAGE =
    'The project has no .venv folder, and VIRTUAL_ENV names no environment. Create the environment with the package manager of the project, such as uv sync, or activate it, then check again.';
export const PYTHON_EXECUTABLE = 'python';

// tool processes
export const TOOL_ENVIRONMENT = { NO_COLOR: '1', FORCE_COLOR: '0', PYTHONUTF8: '1' } as const;

// tool states
export const AVAILABLE_TOOL_STATES: ReadonlySet<string> = new Set(['ok', 'system', 'newer']);
export const INSTALL_HELP = 'Run gspot install.';
export const MISE_INSTALL_URL = 'https://mise.jdx.dev/getting-started.html';
export const PROJECT_DEPENDENCIES_MESSAGE =
    'Install the project dependencies first: node_modules is missing in {folder}.';
export const ROOT_FOLDER_NAME = 'the repository root';
export const TOOL_STATES = ['ok', 'outdated', 'newer', 'missing', 'system', 'error'] as const;

// typescript version
export const TYPESCRIPT_ESLINT_TOOL = 'typescript-eslint';
export const TYPESCRIPT_PACKAGE = 'typescript';

// versions
export const DISTRIBUTION_SUFFIX = '.dist-info';
export const NO_VERSION = 'No version is set for shim';
export const PYTHON_LIBRARY_FOLDERS = ['lib', 'Lib'] as const;
export const PYTHON_PACKAGES_FOLDER = 'site-packages';
export const STACK_FRAME_LINE = /^\s+at /u;
export const VERSION_FLAG = '--version';
