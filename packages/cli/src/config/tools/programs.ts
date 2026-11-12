import { MISE_CONFIG_FILE, MISE_LOCKFILE } from '#cli/config/manifests.ts';

export const STYLELINT_MANIFEST_TOOL = 'stylelint';

export const STACK_FRAME_LINE = /^\s+at /u;

export const MISE_INSTALL_URL = 'https://mise.jdx.dev/getting-started.html';

export const AVAILABLE_TOOL_STATES: ReadonlySet<string> = new Set(['ok', 'system', 'newer']);

export const TOOL_STATES = ['ok', 'outdated', 'newer', 'missing', 'system', 'error'] as const;

export const INSTALL_HELP = 'Run gspot install.';

export const MISE_LAUNCHER_FOLDER = 'shims';

export const MISE_WHICH = 'which';

export const BIN_FOLDER_NAME = '.bin';

export const NPM_BIN_FOLDER = `node_modules/${BIN_FOLDER_NAME}`;

export const MISE_CONFIG_PREFIXES = ['mise', '.mise', '.rtx'] as const;

export const MISE_CONFIG_NAMES: ReadonlySet<string> = new Set(['.tool-versions', '.config']);

export const MISE_PROJECT_FILES = new Set([MISE_CONFIG_FILE, MISE_LOCKFILE]);

export const TOOL_ENVIRONMENT = { NO_COLOR: '1', FORCE_COLOR: '0', PYTHONUTF8: '1' } as const;

export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;

export const PROJECT_ENVIRONMENT_MESSAGE =
    'The project has no .venv folder, and VIRTUAL_ENV names no environment. Create the environment with the package manager of the project, such as uv sync, or activate it, then check again.';

export const NO_VERSION = 'No version is set for shim';

export const PYTHON_LIBRARY_FOLDERS = ['lib', 'Lib'] as const;

export const PYTHON_PACKAGES_FOLDER = 'site-packages';

export const DISTRIBUTION_SUFFIX = '.dist-info';

export const ESLINT_BUILTIN_RULES = 'eslint/use-at-your-own-risk';

export const INSTALL_FOR_RULES_MESSAGE =
    'gspot explain reads lint rules from the tools that gspot install puts in .gspot/node_modules. Run gspot install.';

export const MARKDOWNLINT_RULE_SCHEMA = '../schema/markdownlint-config-schema.json';

export const MARKDOWNLINT_RULE_DESCRIPTION = /^MD\d+\/[^:]+ : (.+) : (https:\/\/\S+)$/u;

export const SWIFTLINT_RULE_ARGUMENTS = ['rules', '--default-config', '--config'] as const;

export const SWIFTLINT_RULE_IDENTIFIER = /^[a-z][a-z0-9_]*$/u;

export const SHELLCHECK_RULE_IDENTIFIER = /^SC\d{4}$/u;

export const ROOT_FOLDER_NAME = 'the repository root';
