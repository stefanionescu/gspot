// The paths gspot writes under `.gspot`, each named once.

/** The folder gspot writes for a repository; every path below sits inside it. */
export const DOT_GSPOT = '.gspot';

/** The lifecycle state: the ownership log and the locks, never committed. */
export const STATE_DIRECTORY = '.gspot/state';
export const CONFIGURATION_DIRECTORY = '.gspot/config';

/** The folder of the hook scripts gspot writes, which core.hooksPath names. */
export const HOOKS_DIRECTORY = '.gspot/hooks';
export const RULES_DIRECTORY = '.gspot/rules';
export const VERSION_FILE = '.gspot/version';
export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';
export const TOOL_PACKAGE_PROJECT = '.gspot/package.json';
export const TOOL_PYTHON_PROJECT = '.gspot/pyproject.toml';
export const YARN_SETTINGS = '.gspot/.yarnrc.yml';
export const UV_LOCK = '.gspot/uv.lock';
export const GITLEAKS_BASELINE = '.gspot/gitleaks-baseline.json';
export const ESLINT_FILE = '.gspot/config/eslint.config.mjs';
export const VALE_CONFIG = '.gspot/config/vale.ini';

/** The style directory Vale reads, where Vale packages land beside the gspot style. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';
