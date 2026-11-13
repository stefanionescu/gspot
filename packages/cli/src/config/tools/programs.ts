import { MISE_CONFIG_FILE, MISE_LOCKFILE } from '#cli/config/manifests.ts';
import { NODE_MODULES } from '#cli/config/system.ts';

// mise lookup
export const MISE_CONFIG_NAMES: ReadonlySet<string> = new Set(['.tool-versions', '.config']);
export const MISE_CONFIG_PREFIXES = ['mise', '.mise', '.rtx'] as const;
export const MISE_LAUNCHER_FOLDER = 'shims';
export const MISE_PROJECT_FILES = new Set([MISE_CONFIG_FILE, MISE_LOCKFILE]);
export const MISE_WHICH = 'which';

// npm bin folder
export const BIN_FOLDER_NAME = '.bin';
export const NPM_BIN_FOLDER = `${NODE_MODULES}/${BIN_FOLDER_NAME}`;

// python environment
export const ACTIVE_ENVIRONMENT_VARIABLE = 'VIRTUAL_ENV';
export const PROJECT_ENVIRONMENT_MESSAGE =
    'The project has no .venv folder, and VIRTUAL_ENV names no environment. Create the environment with the package manager of the project, such as uv sync, or activate it, then check again.';

// rule explanations
export const ESLINT_BUILTIN_RULES = 'eslint/use-at-your-own-risk';
export const ESLINT_MANIFEST_TOOL = 'eslint';
export const INSTALL_FOR_RULES_MESSAGE =
    'gspot explain reads lint rules from the tools that gspot install puts in .gspot/node_modules. Run gspot install.';
export const MARKDOWNLINT_RULE_DESCRIPTION = /^MD\d+\/[^:]+ : (.+) : (https:\/\/\S+)$/u;
export const MARKDOWNLINT_RULE_SCHEMA = '../schema/markdownlint-config-schema.json';
export const RUFF_SUMMARY_FIELD = /\{(\w+)?(?::[^{}]*)?\}/gu;
export const SHELLCHECK_RULE_IDENTIFIER = /^SC\d{4}$/u;
export const STYLELINT_MANIFEST_TOOL = 'stylelint';
export const SWIFTLINT_RULE_ARGUMENTS = ['rules', '--default-config', '--config'] as const;
export const SWIFTLINT_RULE_IDENTIFIER = /^[a-z][a-z0-9_]*$/u;
export const SWIFTLINT_UNKNOWN_RULE = 'No rule with identifier';
// ESLint cannot name the gspot setting that declares the global names of another runtime.
export const UNDEFINED_NAME_FIX =
    'Declare or import the name. For a global name of another runtime, such as `document` in a browser script, write a [[tools.eslint.override]] record in gspot.toml with the paths of the files and runtime = "browser", then run gspot install.';

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

// versions
export const DISTRIBUTION_SUFFIX = '.dist-info';
export const NO_VERSION = 'No version is set for shim';
export const PYTHON_LIBRARY_FOLDERS = ['lib', 'Lib'] as const;
export const PYTHON_PACKAGES_FOLDER = 'site-packages';
export const STACK_FRAME_LINE = /^\s+at /u;
export const VERSION_FLAG = '--version';
