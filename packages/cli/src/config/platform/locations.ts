/** The npm and Python tool projects use one unscoped name supported by both registries. */
export const TOOLS_PROJECT = 'gspot-tools';

export const CONFIGURATION_DIRECTORY = '.gspot/config';

export const POLICY_FILE = 'gspot.toml';

export const TOOL_PYTHON_PROJECT = '.gspot/pyproject.toml';

export const UV_LOCK = '.gspot/uv.lock';

export const VALE_CONFIG = '.gspot/config/vale.ini';

/** The style directory Vale reads, where Vale packages land beside the gspot style. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';

export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';

export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';

export const TOOL_PACKAGE_PROJECT = '.gspot/package.json';

export const YARN_SETTINGS = '.gspot/.yarnrc.yml';

export const GITLEAKS_BASELINE = '.gspot/gitleaks-baseline.json';

/** The folder gspot writes for a repository; every path below sits inside it. */
export const DOT_GSPOT = '.gspot';

export const VERSION_FILE = '.gspot/version';

/** The lifecycle state: the ownership log and the locks, never committed. */
export const STATE_DIRECTORY = '.gspot/state';

/** The folder of the hook scripts gspot writes, which core.hooksPath names. */
export const HOOKS_DIRECTORY = '.gspot/hooks';

export const ESLINT_FILE = '.gspot/config/eslint.config.mjs';

export const RULES_DIRECTORY = '.gspot/rules';

export const MISE_CONFIG_PATH = '.mise/conf.d/gspot-tools.toml';

/** The tool project folder written and replaced for each installation kind. */
export const INSTALLATION_DIRECTORIES = { npm: NODE_MODULES_DIRECTORY, python: PYTHON_ENVIRONMENT_DIRECTORY } as const;
